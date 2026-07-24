# TrustSync.AI

TrustSync.AI is an intelligent payment recovery platform built for the **AI Innovation Hackathon (AI for Cluster Intelligence)**.

## The Problem
Digital payment systems rely on webhooks. However, network interruptions or overloaded merchant servers can cause webhooks to fail, even if the payment succeeds. Standard systems blindly retry these failures or drop them, leading to lost revenue and customer support nightmares.

## The AI Solution
TrustSync.AI does not just react to 500 errors. It uses an **Isolation Forest ML model** to analyze real-time cluster telemetry (latency, error rates, payload size, time of day). 
When a webhook is destined for a degraded merchant server, the AI **predicts the failure before it happens**, intercepts the webhook, and intelligently schedules a retry (via Celery) for when the network is predicted to be healthy.

## Revenue Saved (ROI)
By preventing hard failures and automating recovery, TrustSync.AI directly saves merchants revenue and reduces manual reconciliation efforts. The dashboard tracks the exact dollar value of transactions saved by AI intervention.

## How to Run the Demo

To make evaluating this project extremely simple, everything has been 100% Dockerized! The application uses **PostgreSQL** to persistently store transactions and stats, proving this is a robust, dynamic application—not static mock data!

Just run the following command in the project root:

```bash
docker-compose up -d --build
```

### Services Available:
- **Dashboard (Next.js)**: `http://localhost:3000`
- **AI Core API (FastAPI)**: `http://localhost:8000/docs`
- **Simulators**: Running in background, automatically generating telemetry.
- **Database (PostgreSQL)**: Port `5432`

You can use the **"Toggle Network Health"** button on the dashboard to manually trigger the merchant server to degrade, and watch the AI instantly catch the failures and queue them on the right side!
