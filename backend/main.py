import os
import uuid
import datetime
import pickle
import pandas as pd
import httpx
from fastapi import FastAPI, BackgroundTasks, Request, Depends, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from tasks import process_webhook_retry
from database import init_db, get_db, WebhookTransaction, SystemLog, IdempotencyKey, MerchantBudget

init_db()

app = FastAPI(title="TrustSync.AI - AI Webhook Recovery")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Duplicate Guard & Retry Budget Config ────────────────────────────────────
RETRY_BUDGET_LIMIT = int(os.getenv("RETRY_BUDGET_LIMIT", "5"))   # max retries per window
RETRY_WINDOW_SECONDS = int(os.getenv("RETRY_WINDOW_SECONDS", "60"))  # window size in seconds

# Load Model
MODEL_PATH = "models/predictor.pkl"
model = None

try:
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    print("AI Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model not found at {MODEL_PATH}. Run train_model.py first. Error: {e}")

# Mock telemetry for simplicity (In reality, this comes from Prometheus/APM)
current_telemetry = {
    "merchant_latency_avg_5m": 200,
    "merchant_error_rate_5m": 0.01,
}

def add_log(db: Session, message: str, log_type: str = "info"):
    log = SystemLog(message=message, type=log_type)
    db.add(log)
    db.commit()

# ─── Duplicate Guard helpers ─────────────────────────────────────────────────

def check_idempotency(db: Session, key: str, merchant_id: str, target_url: str) -> bool:
    """Returns True if the key is new (accepted). False if it's a duplicate."""
    existing = db.query(IdempotencyKey).filter(IdempotencyKey.idempotency_key == key).first()
    if existing:
        # Log the duplicate attempt
        duplicate_log = IdempotencyKey(
            idempotency_key=key + f"_dup_{uuid.uuid4().hex[:6]}",
            merchant_id=merchant_id,
            target_url=target_url,
            status="duplicate_blocked"
        )
        db.add(duplicate_log)
        db.commit()
        return False
    # Register the new key
    new_key = IdempotencyKey(
        idempotency_key=key,
        merchant_id=merchant_id,
        target_url=target_url,
        status="accepted"
    )
    db.add(new_key)
    db.commit()
    return True

# ─── Retry Budget helpers ─────────────────────────────────────────────────────

def get_or_create_budget(db: Session, merchant_id: str) -> MerchantBudget:
    budget = db.query(MerchantBudget).filter(MerchantBudget.merchant_id == merchant_id).first()
    if not budget:
        budget = MerchantBudget(merchant_id=merchant_id)
        db.add(budget)
        db.commit()
        db.refresh(budget)
    return budget

def increment_retry_budget(db: Session, merchant_id: str) -> MerchantBudget:
    """Increments retry count for a merchant. Resets window if expired. Auto-pauses if over limit."""
    budget = get_or_create_budget(db, merchant_id)
    now = datetime.datetime.utcnow()

    # Reset window if expired
    if (now - budget.window_start).total_seconds() > RETRY_WINDOW_SECONDS:
        budget.retry_count = 0
        budget.window_start = now

    budget.retry_count += 1

    # Auto-pause if over limit
    if budget.retry_count >= RETRY_BUDGET_LIMIT and not budget.is_paused:
        budget.is_paused = True
        budget.paused_reason = f"Retry budget exceeded: {budget.retry_count}/{RETRY_BUDGET_LIMIT} retries in {RETRY_WINDOW_SECONDS}s window"
        budget.paused_at = now
        add_log(db, f"MERCHANT PAUSED: {merchant_id} — {budget.paused_reason}", "warning")

    db.commit()
    db.refresh(budget)
    return budget

# ─── Pydantic models ──────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    target_url: str
    merchant_id: str
    transaction_amount: float
    payload: Dict[str, Any]
    idempotency_key: Optional[str] = None  # Client can supply; auto-generated if omitted

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/update_telemetry")
async def update_telemetry(latency: float, error_rate: float):
    """Endpoint for simulators to update their health status"""
    current_telemetry["merchant_latency_avg_5m"] = latency
    current_telemetry["merchant_error_rate_5m"] = error_rate
    return {"status": "updated", "telemetry": current_telemetry}

@app.post("/send_webhook")
async def send_webhook(webhook: WebhookPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ── 0. Resolve idempotency key ────────────────────────────────────────────
    idem_key = webhook.idempotency_key or str(uuid.uuid4())

    # ── 1. Duplicate Guard ────────────────────────────────────────────────────
    is_new = check_idempotency(db, idem_key, webhook.merchant_id, webhook.target_url)
    if not is_new:
        add_log(db, f"DUPLICATE BLOCKED: idempotency_key={idem_key} for merchant={webhook.merchant_id}", "warning")
        return {
            "status": "duplicate_blocked",
            "message": "This payment was already delivered. Duplicate webhook rejected.",
            "idempotency_key": idem_key,
        }

    # ── 2. Retry Budget Check ─────────────────────────────────────────────────
    budget = get_or_create_budget(db, webhook.merchant_id)
    if budget.is_paused:
        add_log(db, f"MERCHANT PAUSED — rejecting webhook for {webhook.merchant_id}", "error")
        return {
            "status": "merchant_paused",
            "message": f"Merchant {webhook.merchant_id} is paused for review. No webhooks accepted.",
            "reason": budget.paused_reason,
            "paused_at": budget.paused_at.isoformat() if budget.paused_at else None,
        }

    # ── 3. Feature Extraction for AI ─────────────────────────────────────────
    payload_size_kb = len(str(webhook.payload)) / 1024.0
    hour = datetime.datetime.now().hour
    day = datetime.datetime.now().weekday()

    features = pd.DataFrame([{
        "merchant_latency_avg_5m": current_telemetry["merchant_latency_avg_5m"],
        "merchant_error_rate_5m": current_telemetry["merchant_error_rate_5m"],
        "payload_size_kb": payload_size_kb,
        "hour_of_day": hour,
        "day_of_week": day
    }])

    # ── 4. AI Prediction ──────────────────────────────────────────────────────
    will_fail = False
    if model:
        prediction = model.predict(features)[0]
        will_fail = bool(prediction == 1)

    if will_fail:
        # AI Intervenes!
        tx = WebhookTransaction(
            target_url=webhook.target_url,
            merchant_id=webhook.merchant_id,
            amount=webhook.transaction_amount,
            status="queued",
            ai_intervened=True
        )
        db.add(tx)
        add_log(db, f"AI PREDICTED FAILURE. Routing to Celery retry queue for {webhook.target_url}", "warning")

        # Increment retry budget for the queued attempt
        increment_retry_budget(db, webhook.merchant_id)

        # Smart schedule: delay by 10 seconds to allow merchant server recovery
        process_webhook_retry.apply_async(
            args=[webhook.payload, webhook.target_url, webhook.merchant_id],
            countdown=10
        )
        return {
            "status": "queued",
            "message": "AI predicted failure. Webhook queued for smart delivery.",
            "idempotency_key": idem_key,
        }

    # ── 5. Direct Delivery if AI says it's healthy ────────────────────────────
    add_log(db, f"AI predicted success. Direct delivery to {webhook.target_url}", "info")
    try:
        response = httpx.post(webhook.target_url, json=webhook.payload, timeout=5.0)
        response.raise_for_status()

        tx = WebhookTransaction(
            target_url=webhook.target_url,
            merchant_id=webhook.merchant_id,
            amount=webhook.transaction_amount,
            status="delivered",
            ai_intervened=False
        )
        db.add(tx)
        db.commit()
        add_log(db, f"Successfully delivered to {webhook.target_url}", "success")
        return {"status": "delivered", "idempotency_key": idem_key}
    except Exception as e:
        tx = WebhookTransaction(
            target_url=webhook.target_url,
            merchant_id=webhook.merchant_id,
            amount=webhook.transaction_amount,
            status="failed_but_queued",
            ai_intervened=False
        )
        db.add(tx)
        db.commit()
        add_log(db, f"Direct delivery failed! AI missed this. Error: {str(e)}", "error")
        # Increment retry budget for the failed+queued attempt
        increment_retry_budget(db, webhook.merchant_id)
        # Fallback to retry queue anyway
        process_webhook_retry.apply_async(
            args=[webhook.payload, webhook.target_url, webhook.merchant_id],
            countdown=5
        )
        return {"status": "failed_but_queued", "error": str(e), "idempotency_key": idem_key}


@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Endpoint for the Next.js Dashboard to fetch real-time metrics from DB"""
    total = db.query(WebhookTransaction).count()
    delivered = db.query(WebhookTransaction).filter(WebhookTransaction.status == "delivered").count()
    failed = db.query(WebhookTransaction).filter(WebhookTransaction.status == "failed_but_queued").count()
    ai_interventions = db.query(WebhookTransaction).filter(WebhookTransaction.ai_intervened == True).count()

    # Calculate revenue saved
    saved_txs = db.query(WebhookTransaction).filter(WebhookTransaction.ai_intervened == True).all()
    revenue_saved = sum([tx.amount for tx in saved_txs])

    # Guard stats
    duplicates_blocked = db.query(IdempotencyKey).filter(IdempotencyKey.status == "duplicate_blocked").count()
    paused_merchants_count = db.query(MerchantBudget).filter(MerchantBudget.is_paused == True).count()

    # Get recent logs (last 50)
    recent_logs_query = db.query(SystemLog).order_by(SystemLog.id.desc()).limit(50).all()
    recent_logs = [
        {
            "time": log.timestamp.strftime("%H:%M:%S"),
            "message": log.message,
            "type": log.type
        }
        for log in recent_logs_query
    ]

    return {
        "total_webhooks": total,
        "successful_webhooks": delivered,
        "failed_webhooks": failed,
        "ai_interventions": ai_interventions,
        "revenue_saved": revenue_saved,
        "duplicates_blocked": duplicates_blocked,
        "paused_merchants_count": paused_merchants_count,
        "recent_logs": recent_logs,
    }


# ─── Guard API endpoints ──────────────────────────────────────────────────────

@app.get("/guard/report")
async def get_matching_report(db: Session = Depends(get_db)):
    """
    Matching Report: lists all accepted idempotency keys with their delivery status.
    Proves each payment was delivered exactly once.
    """
    keys = db.query(IdempotencyKey).order_by(IdempotencyKey.created_at.desc()).limit(100).all()
    report = []
    for k in keys:
        # Find the matching transaction (same merchant + url, nearest time)
        tx = db.query(WebhookTransaction).filter(
            WebhookTransaction.merchant_id == k.merchant_id,
            WebhookTransaction.target_url == k.target_url,
        ).order_by(WebhookTransaction.id.desc()).first()

        report.append({
            "idempotency_key": k.idempotency_key,
            "merchant_id": k.merchant_id,
            "target_url": k.target_url,
            "status": k.status,
            "created_at": k.created_at.isoformat(),
            "delivery_status": tx.status if tx else "no_transaction",
            "amount": tx.amount if tx else 0,
        })
    return {"report": report, "total": len(report)}


@app.get("/guard/paused-merchants")
async def get_paused_merchants(db: Session = Depends(get_db)):
    """Returns all merchants currently paused by the retry budget."""
    paused = db.query(MerchantBudget).filter(MerchantBudget.is_paused == True).all()
    return {
        "paused_merchants": [
            {
                "merchant_id": m.merchant_id,
                "retry_count": m.retry_count,
                "retry_limit": RETRY_BUDGET_LIMIT,
                "window_seconds": RETRY_WINDOW_SECONDS,
                "paused_reason": m.paused_reason,
                "paused_at": m.paused_at.isoformat() if m.paused_at else None,
            }
            for m in paused
        ],
        "total": len(paused),
    }


@app.get("/guard/budgets")
async def get_all_budgets(db: Session = Depends(get_db)):
    """Returns retry budget status for all merchants."""
    budgets = db.query(MerchantBudget).all()
    return {
        "budgets": [
            {
                "merchant_id": b.merchant_id,
                "retry_count": b.retry_count,
                "retry_limit": RETRY_BUDGET_LIMIT,
                "window_seconds": RETRY_WINDOW_SECONDS,
                "is_paused": b.is_paused,
                "window_start": b.window_start.isoformat(),
            }
            for b in budgets
        ]
    }


@app.post("/guard/unblock/{merchant_id}")
async def unblock_merchant(merchant_id: str, db: Session = Depends(get_db)):
    """Admin: clear a merchant's pause state and reset their retry budget."""
    budget = db.query(MerchantBudget).filter(MerchantBudget.merchant_id == merchant_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail=f"Merchant {merchant_id} not found")

    budget.is_paused = False
    budget.retry_count = 0
    budget.paused_reason = None
    budget.paused_at = None
    budget.window_start = datetime.datetime.utcnow()
    db.commit()

    add_log(db, f"MERCHANT UNBLOCKED: {merchant_id} — retry budget reset by admin", "info")
    return {"status": "unblocked", "merchant_id": merchant_id}
