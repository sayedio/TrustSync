# 📡 TrustSync.AI — Project Scan & Technical Overview

> **Intelligent Payment Resilience Platform** — AI-powered webhook recovery & smart delivery system  
> Built for the **AI Innovation Hackathon (AI for Cluster Intelligence)**

---

## 📁 Project Structure

```
TrustSync/
├── backend/                    # Python FastAPI + Celery AI Core
│   ├── main.py                 # FastAPI app, AI inference, API endpoints
│   ├── database.py             # SQLAlchemy models & DB session management
│   ├── tasks.py                # Celery tasks for retry queue
│   ├── train_model.py          # ML model training script
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile
│   └── models/
│       └── predictor.pkl       # Pre-trained ML model (~2MB)
│
├── frontend/                   # Next.js 16 + TypeScript Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main dashboard page
│   │   │   ├── layout.tsx      # Root layout
│   │   │   ├── globals.css     # Global styles + Tailwind
│   │   │   ├── api/chat/       # Next.js API route for AI chat
│   │   │   ├── architecture/   # Architecture diagram page
│   │   │   ├── finops/         # FinOps / cost savings page
│   │   │   ├── intelligence/   # AI intelligence page
│   │   │   ├── lab/            # Chaos Lab page
│   │   │   └── vault/          # Transaction vault page
│   │   ├── components/
│   │   │   ├── AIChatWidget.tsx
│   │   │   ├── ArchitectureDiagram.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SimulationFlow.tsx
│   │   │   └── Topbar.tsx
│   │   └── context/
│   │       └── ClusterContext.tsx
│   ├── package.json
│   ├── next.config.ts
│   └── Dockerfile
│
├── simulators/                 # Node.js Merchant + Gateway Simulators
│   ├── merchant.js             # Merchant server (with chaos mode)
│   ├── gateway.js              # Payment gateway simulator
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml          # Full orchestration (6 services)
├── README.md
└── TRUSTSYNC_FULL_OVERVIEW.md
```

---

## 🔧 Tech Stack

### Backend
| Layer | Technology | Purpose |
|---|---|---|
| API Framework | **FastAPI** (Python) | REST API, webhook ingestion |
| Task Queue | **Celery** | Async retry scheduling |
| Message Broker | **Redis** | Celery broker + result backend |
| Database | **PostgreSQL** / SQLite (fallback) | Transaction & log storage |
| ORM | **SQLAlchemy** | DB models & sessions |
| HTTP Client | **httpx** | Outbound webhook delivery |
| ML / AI | **scikit-learn** (Isolation Forest / Random Forest) | Failure prediction |
| Data Processing | **pandas**, **numpy** | Feature engineering |

### Frontend
| Layer | Technology | Purpose |
|---|---|---|
| Framework | **Next.js 16** (React 19) | Dashboard UI + API routes |
| Language | **TypeScript** | Type safety |
| Styling | **Tailwind CSS v4** | Utility-first CSS |
| Animation | **Framer Motion** | UI animations |
| Charts | **Recharts** | Data visualizations |
| Icons | **Lucide React** | Icon set |

### Simulators
| Component | Technology | Purpose |
|---|---|---|
| Merchant Server | **Node.js** + Express | Simulates real merchant endpoints |
| Gateway | **Node.js** | Simulates payment gateway traffic |

### Infrastructure
| Component | Technology |
|---|---|
| Containerization | **Docker** + **Docker Compose** |
| Database | **PostgreSQL 15 Alpine** |
| Cache/Queue | **Redis Alpine** |

---

## 🚀 Services (Docker Compose)

| Service | Port | Description |
|---|---|---|
| `db` | `5432` | PostgreSQL database |
| `redis` | `6379` | Redis broker for Celery |
| `backend` | `8000` | FastAPI AI Core + Swagger UI |
| `celery_worker` | — | Background retry worker |
| `simulators` | `4000` | Merchant + gateway simulators |
| `frontend` | `3000` | Next.js dashboard |

---

## 🤖 AI / ML System

### Model
- **Type**: Random Forest Classifier / Isolation Forest Anomaly Model
- **File**: `backend/models/predictor.pkl` (~2 MB)
- **Training**: `backend/train_model.py`
- **Inference Time**: < 4ms

### Feature Vector (5 Signals)

| Feature | Description |
|---|---|
| `merchant_latency_avg_5m` | Avg response time (ms) over last 5 min |
| `merchant_error_rate_5m` | % of recent requests that resulted in 5xx errors |
| `payload_size_kb` | Webhook payload size in KB |
| `hour_of_day` | Hour (0–23) — detects peak traffic windows |
| `day_of_week` | Day (0–6) — detects weekend vs. weekday patterns |

### Decision Logic

```
Anomaly Score < 0.50  →  Prediction: 0 (HEALTHY)  →  Direct HTTP delivery (~14ms)
Anomaly Score ≥ 0.50  →  Prediction: 1 (WILL FAIL) →  AI Intercepts → Celery Queue → Smart Retry
```

---

## 🌐 API Endpoints

### `POST /send_webhook`
Main ingress. Accepts a webhook payload, runs AI inference, and either delivers directly or routes to Celery queue.

**Request Body:**
```json
{
  "target_url": "http://merchant-server/webhook",
  "merchant_id": "merchant_001",
  "transaction_amount": 250.00,
  "payload": {}
}
```

**Responses:**
```json
{ "status": "delivered" }
{ "status": "queued", "message": "AI predicted failure. Webhook queued for smart delivery." }
{ "status": "failed_but_queued", "error": "..." }
```

---

### `GET /stats`
Real-time metrics for the dashboard.

**Response:**
```json
{
  "total_webhooks": 142,
  "successful_webhooks": 128,
  "failed_webhooks": 4,
  "ai_interventions": 10,
  "revenue_saved": 12450.00,
  "recent_logs": []
}
```

---

### `POST /update_telemetry?latency=&error_rate=`
Called by simulators every 5s to update live server health metrics used by the AI.

---

## 🗄️ Database Schema

### `webhook_transactions`
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `target_url` | String | Destination webhook URL |
| `merchant_id` | String | Merchant identifier |
| `amount` | Float | Transaction value (USD) |
| `status` | String | `delivered` / `failed_but_queued` / `queued` |
| `ai_intervened` | Boolean | Whether AI intercepted this webhook |
| `timestamp` | DateTime | UTC time of event |

### `system_logs`
| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment |
| `message` | String | Log message |
| `type` | String | `info` / `warning` / `error` / `success` |
| `timestamp` | DateTime | UTC time of log entry |

---

## ⚙️ Celery Retry Logic

- **Task**: `process_webhook_retry` (in `tasks.py`)
- **Max Retries**: 3
- **Backoff**: Exponential (`2 ^ retry_count` seconds)
- **Broker**: Redis (`redis://redis:6379/0`)
- **Initial Delay**: 10s countdown (allows merchant server to recover)

---

## 🧪 Chaos Lab — 5 Simulation Stages

| Stage | Scenario | AI Response |
|---|---|---|
| 🟢 **Baseline Normal** | ~120 TPS normal traffic | CPU inference, direct delivery, 14ms, 99.999% SLA |
| ⚡ **5,000 TPS Surge** | Black Friday flash sale spike | KEDA scales 0→5 GPU inference nodes |
| 🔴 **Hardware Failure** | Worker node memory leak / DB deadlock | Isolation Forest detects failure, 100% webhooks queued |
| 🌙 **Off-Peak Nighttime** | Midnight–5AM, ~10 TPS | FinOps: GPUs scale to zero, 78%+ cost savings |
| ⏱️ **500ms Bottleneck** | Network congestion / slow response | LSTM predicts recovery window, >98.5% recovery rate |

---

## 🖥️ Frontend Pages

| Route | Description |
|---|---|
| `/` | Main dashboard — live stats, logs, revenue saved |
| `/architecture` | System architecture diagram |
| `/finops` | FinOps and cost savings visualization |
| `/intelligence` | AI model insights |
| `/lab` | Chaos Lab — trigger simulation stages |
| `/vault` | Transaction vault — full webhook history |

---

## 🎭 Simulator Behavior

### Merchant Server (`merchant.js`)
- Runs on **port 4000**
- Reports telemetry to AI service every **5 seconds**
- **Normal mode**: < 150ms response, 1% error rate
- **Degraded mode**: 500–1000ms latency, 10–50% error rate, 50% chance of HTTP 500

**Endpoints:**
| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook` | Receive webhooks |
| `GET` | `/status` | Returns `{ degraded: boolean }` |
| `POST` | `/admin/set-chaos` | Trigger chaos mode via error_rate/latency |

---

## ▶️ Quick Start

```bash
git clone <repo-url>
cd TrustSync
docker-compose up -d --build
```

| URL | Service |
|---|---|
| http://localhost:3000 | Next.js Dashboard |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:4000/status | Merchant Simulator Status |

> 💡 Use the **"Toggle Network Health"** button on the dashboard to manually degrade the merchant server and watch the AI intercept webhooks in real-time.

---

## 📦 Backend Dependencies

```
fastapi, uvicorn         # API server
celery, redis            # Task queue
scikit-learn             # ML model
pandas, numpy            # Data processing
httpx                    # HTTP client
pydantic                 # Data validation
python-dotenv            # Environment variables
sqlalchemy               # ORM
psycopg2-binary          # PostgreSQL driver
```

---

## 💰 Business Impact

| Metric | Value |
|---|---|
| Webhook loss prevention | **99.99% SLA recovery rate** |
| Infrastructure cost savings | **78%+ reduction** via GPU scale-to-zero |
| Revenue protection | **100% of intercepted transactions recovered** |
| AI inference latency | **< 4ms per prediction** |

---

*Scanned by Antigravity — 2026-07-25*
