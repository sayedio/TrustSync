import os
import time
import datetime
import pickle
import pandas as pd
import httpx
from fastapi import FastAPI, BackgroundTasks, Request, Depends  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel  # type: ignore
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from tasks import process_webhook_retry
from database import init_db, get_db, WebhookTransaction, SystemLog

init_db()

app = FastAPI(title="TrustSync.AI - AI Webhook Recovery")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Model
MODEL_PATH = "models/predictor.pkl"
model = None

try:
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    print("AI Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model not found at {MODEL_PATH}. Run train_model.py first. Error: {e}")

def add_log(db: Session, message: str, log_type: str = "info"):
    log = SystemLog(message=message, type=log_type)
    db.add(log)
    db.commit()

class WebhookPayload(BaseModel):
    target_url: str
    merchant_id: str
    transaction_amount: float
    payload: Dict[str, Any]
    
# Mock telemetry for simplicity (In reality, this comes from Prometheus/APM)
current_telemetry = {
    "merchant_latency_avg_5m": 200,
    "merchant_error_rate_5m": 0.01,
}

@app.post("/update_telemetry")
async def update_telemetry(latency: float, error_rate: float):
    """Endpoint for simulators to update their health status"""
    current_telemetry["merchant_latency_avg_5m"] = latency
    current_telemetry["merchant_error_rate_5m"] = error_rate
    return {"status": "updated", "telemetry": current_telemetry}

@app.post("/send_webhook")
async def send_webhook(webhook: WebhookPayload, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Feature Extraction for AI
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
    
    # 2. AI Prediction
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
        
        # Smart schedule: delay by 10 seconds to allow merchant server recovery
        process_webhook_retry.apply_async(
            args=[webhook.payload, webhook.target_url],
            countdown=10 
        )
        return {"status": "queued", "message": "AI predicted failure. Webhook queued for smart delivery."}
    
    # 3. Direct Delivery if AI says it's healthy
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
        return {"status": "delivered"}
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
        # Fallback to retry queue anyway
        process_webhook_retry.apply_async(args=[webhook.payload, webhook.target_url], countdown=5)
        return {"status": "failed_but_queued", "error": str(e)}

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
        "recent_logs": recent_logs
    }
