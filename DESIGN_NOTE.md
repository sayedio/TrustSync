# 📝 Design Choices & Technical Note

**Team Name:** The Overfitters  
**Project Title:** TrustSync.AI — Intelligent Payment Recovery for Webhook Failures  
**Track:** AI for Cluster Intelligence (Predictive Operations)  
**Hackathon:** AI Innovation Hackathon 2026 (Dept. of CSE, DIU)  

---

## 1. Executive Summary

To satisfy the additional challenge requirement, we designed and integrated the **"Duplicate Guard & Retry Budget"** module directly on top of TrustSync.AI's existing AI anomaly triage layer. 

In digital payments, **duplicate delivery is as costly as a dropped message**. A system that retries unconditionally risks double-charging customers or causing double order fulfillments. Furthermore, retry storms targeted at a degraded merchant server consume shared infrastructure resources and degrade system-wide SLA. 

Our module guarantees **Exact-Once Payment Processing** and **Circuit-Breaking Resilience** via two deterministic, low-latency control layers.

---

## 2. Key Architecture & Design Decisions

```
 Gateway Webhook Ingress
           │
           ▼
┌────────────────────────────────────────┐
│  LAYER 1: Duplicate Guard (Idempotency)│ ──► Key exists in DB/Redis? ──► [BLOCKED 409] (No Retry)
└──────────────────┬─────────────────────┘
                   │ Key is Unique
                   ▼
┌────────────────────────────────────────┐
│  LAYER 2: Retry Budget (Rate Quota)   │ ──► Quota > 5 retries / 60s? ──► [PAUSED 503] (Flagged for Review)
└──────────────────┬─────────────────────┘
                   │ Within Budget
                   ▼
┌────────────────────────────────────────┐
│  LAYER 3: AI Anomaly Triage Engine    │ ──► Anomaly Score >= 0.50?   ──► Redis + Celery Retry Queue
└────────────────────────────────────────┘
```

### Choice 1: Pre-Triage Idempotency Enforcement (Duplicate Guard)
* **Design Decision**: Check idempotency **before** AI inference and network dispatch.
* **Mechanism**: Every incoming payment is tagged with a unique `idempotency_key` (UUID v4 or gateway transaction ID). The key is stored in PostgreSQL (`idempotency_keys`) and cached in Redis.
* **Behavior**: If a retry or duplicate request arrives with a previously seen key, it is instantly halted with status `duplicate_blocked` (HTTP 409). No downstream merchant API is called twice, protecting merchant servers from duplicate order fulfillment.

### Choice 2: Sliding-Window Retry Budget (Circuit Breaker)
* **Design Decision**: Per-merchant rate quota instead of system-wide limits.
* **Mechanism**: Tracks retry attempts per merchant ID inside a 60-second rolling window (`merchant_budgets` table).
* **Threshold**: Maximum **5 failed retries per merchant per minute**.
* **Behavior**: When a merchant server enters a crash loop or deadlock and exceeds 5 retries, the Retry Budget automatically **pauses the merchant** (`is_paused = True`). Webhook delivery for that merchant is suspended and flagged for review, preventing retry storms from overwhelming shared worker pools.

### Choice 3: Deterministic Matching Report
* **Design Decision**: Provide cryptographic/audit-level proof of delivery states.
* **Mechanism**: The system maintains a real-time matching log joining `IdempotencyKey` records with `WebhookTransaction` outcomes.
* **Proof**: Every `DELIVERED` or `RECOVERED` entry carries a `VERIFIED UNIQUE` audit badge confirming that exactly 1 delivery succeeded and 0 duplicate payloads were accepted.

---

## 3. Technology Stack Integration

* **Backend Engine**: FastAPI + SQLAlchemy (PostgreSQL / Redis cache)
* **Async Retry Worker**: Celery background runner evaluating merchant budget health before each execution attempt
* **Frontend Control Dashboard**: Next.js 16 + React 19 + Framer Motion (Real-time live telemetry, matching report table, budget meters, and manual unblock controls)

---

## 4. Verification & Live Run Controls

In our live prototype dashboard (`/guard`):
1. **Duplicate Blocking Demo**: Clicking **"Send Duplicate Payment"** sends two webhooks with the same idempotency key — the first delivers successfully, and the second is immediately halted with a `DUPLICATE BLOCKED` badge.
2. **Shop Pause Demo**: Clicking **"Trigger Retry Storm"** sends 6 failing retries to `bKash` — the budget progress bar fills red (5/5), auto-pauses the merchant, and flags it for review.
3. **Matching Report**: The Matching Report table lists all transactions with unique keys, proving zero double-deliveries.
