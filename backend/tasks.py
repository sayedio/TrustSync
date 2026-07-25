import os
import httpx
from celery import Celery, Task  # type: ignore

import ssl

# Redis broker URL (supports standard redis:// and Upstash SSL rediss://)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Enable SSL for rediss:// scheme (Upstash serverless Redis)
ssl_options = {"ssl_cert_reqs": ssl.CERT_NONE} if REDIS_URL.startswith("rediss://") else None

celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_use_ssl=ssl_options,
    redis_backend_use_ssl=ssl_options,
)

@celery_app.task(bind=True, max_retries=3)
def process_webhook_retry(self: Task, payload: dict, target_url: str, merchant_id: str = "unknown"):
    """
    Celery task to send a webhook. Checks merchant pause state before each attempt.
    If it fails, it will automatically retry with exponential backoff.
    """
    from database import SessionLocal, SystemLog, MerchantBudget
    import datetime

    RETRY_BUDGET_LIMIT = int(os.getenv("RETRY_BUDGET_LIMIT", "5"))
    RETRY_WINDOW_SECONDS = int(os.getenv("RETRY_WINDOW_SECONDS", "60"))

    db = SessionLocal()
    try:
        # ── Check merchant pause state before attempting delivery ────────────
        budget = db.query(MerchantBudget).filter(MerchantBudget.merchant_id == merchant_id).first()
        if budget and budget.is_paused:
            log = SystemLog(
                message=f"[Celery] Skipping delivery — merchant {merchant_id} is PAUSED for review.",
                type="warning"
            )
            db.add(log)
            db.commit()
            # Do not retry — merchant is intentionally paused
            return {"status": "skipped_merchant_paused", "merchant_id": merchant_id}

        # ── Attempt delivery ─────────────────────────────────────────────────
        print(f"Executing scheduled webhook delivery to {target_url}...")
        response = httpx.post(target_url, json=payload, timeout=10.0)
        response.raise_for_status()
        print(f"Successfully delivered webhook on retry to {target_url}")

        log = SystemLog(
            message=f"[Celery] Successfully delivered webhook on retry to {target_url}",
            type="success"
        )
        db.add(log)

        # ── Increment retry budget on each Celery attempt ────────────────────
        if not budget:
            budget = MerchantBudget(merchant_id=merchant_id)
            db.add(budget)

        now = datetime.datetime.utcnow()
        if (now - budget.window_start).total_seconds() > RETRY_WINDOW_SECONDS:
            budget.retry_count = 0
            budget.window_start = now

        budget.retry_count += 1

        if budget.retry_count >= RETRY_BUDGET_LIMIT and not budget.is_paused:
            budget.is_paused = True
            budget.paused_reason = (
                f"Retry budget exceeded on Celery worker: "
                f"{budget.retry_count}/{RETRY_BUDGET_LIMIT} retries in {RETRY_WINDOW_SECONDS}s"
            )
            budget.paused_at = now
            pause_log = SystemLog(
                message=f"[Celery] MERCHANT PAUSED: {merchant_id} — {budget.paused_reason}",
                type="warning"
            )
            db.add(pause_log)

        db.commit()
        return {"status": "success", "url": target_url, "recovered": True}

    except httpx.HTTPError as exc:
        # Log the failure
        try:
            log = SystemLog(
                message=f"[Celery] Webhook delivery failed for {target_url}: {str(exc)}. Retrying...",
                type="error"
            )
            db.add(log)
            db.commit()
        except Exception:
            pass

        print(f"Webhook delivery failed: {exc}. Retrying...")
        # Retry with exponential backoff
        countdown = 2 ** self.request.retries
        raise self.retry(exc=exc, countdown=countdown)
    finally:
        db.close()
