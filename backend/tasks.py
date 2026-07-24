import os
import time
import httpx
from celery import Celery, Task  # type: ignore

# Redis broker URL (update if using a different port or host)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(bind=True, max_retries=3)
def process_webhook_retry(self: Task, payload: dict, target_url: str):
    """
    Celery task to send a webhook. If it fails, it will automatically retry.
    """
    print(f"Executing scheduled webhook delivery to {target_url}...")
    try:
        response = httpx.post(target_url, json=payload, timeout=10.0)
        response.raise_for_status()
        print(f"Successfully delivered webhook on retry to {target_url}")
        
        # Log to DB
        from database import SessionLocal, SystemLog
        db = SessionLocal()
        try:
            log = SystemLog(message=f"Successfully delivered webhook on retry to {target_url}", type="success")
            db.add(log)
            db.commit()
        finally:
            db.close()
            
        return {"status": "success", "url": target_url, "recovered": True}
        
    except httpx.HTTPError as exc:
        print(f"Webhook delivery failed: {exc}. Retrying...")
        # Retry with exponential backoff
        countdown = 2 ** self.request.retries
        raise self.retry(exc=exc, countdown=countdown)
