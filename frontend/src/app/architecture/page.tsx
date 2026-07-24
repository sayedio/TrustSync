"use client";
import { useState, useEffect, useCallback } from "react";
import { useCluster, FaultMode } from "@/context/ClusterContext";
import { motion } from "framer-motion";

interface ModeDetail {
  id: FaultMode;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  flowSteps: Array<{ step: string; node: string; desc: string; latency: string }>;
  aiStatus: {
    xgboost: string;
    lstm: string;
    keda: string;
    inference: string;
  };
  metrics: {
    sla: string;
    recoveryRate: string;
    avgLatency: string;
    computeMode: string;
  };
}

const MODES_CONFIG: Record<FaultMode, ModeDetail> = {
  none: {
    id: "none",
    title: "Normal Traffic Baseline",
    badge: "BASELINE OPERATIONAL",
    badgeColor: "var(--green)",
    description: "Standard operational flow. Webhooks pass through AI Ingress and XGBoost Triage (4ms anomaly check). Anomaly scores < 0.05 pass directly to Merchant API Target.",
    flowSteps: [
      { step: "01", node: "Payment Gateways", desc: "Ingress payload from Stripe / bKash / SSLCommerz", latency: "0ms" },
      { step: "02", node: "AI Ingress & Auth", desc: "Rate limiting, payload hash verification & header triage", latency: "2ms" },
      { step: "03", node: "XGBoost Anomaly Triage", desc: "Scans 12 feature vectors. Anomaly Score: 0.03 (Normal)", latency: "4ms" },
      { step: "04", node: "Direct Pass Delivery", desc: "Fast-path execution straight to target Merchant API", latency: "8ms" },
      { step: "05", node: "Merchant Acknowledgment", desc: "HTTP 200 OK received & logged to telemetry stream", latency: "14ms Total" },
    ],
    aiStatus: {
      xgboost: "Active (Filtering normal traffic)",
      lstm: "Standby (No anomaly detected)",
      keda: "Normal baseline (1 pod active)",
      inference: "CPU Inference (Lightweight)",
    },
    metrics: {
      sla: "99.999%",
      recoveryRate: "100% Direct Pass",
      avgLatency: "14ms",
      computeMode: "CPU Minimal (45W)",
    },
  },
  spike: {
    id: "spike",
    title: "High-Volume Traffic Surge (5,000+ TPS)",
    badge: "GPU SCALING ACTIVE",
    badgeColor: "var(--blue)",
    description: "Extreme traffic surge detected. KEDA automatically scales Triton GPU inference cluster from 0 to 5 pods to maintain low latency under extreme concurrency.",
    flowSteps: [
      { step: "01", node: "Payment Gateways", desc: "Massive ingress surge (5,000 TPS Black Friday surge)", latency: "0ms" },
      { step: "02", node: "KEDA Auto-Scaler", desc: "Queue length threshold exceeded → spins up 5 Triton GPU pods", latency: "1.2s" },
      { step: "03", node: "Triton GPU Inference", desc: "Batched tensor acceleration on NVIDIA H100 GPU", latency: "3ms" },
      { step: "04", node: "High-Throughput Pass", desc: "Parallel stream dispatching without bottlenecking", latency: "12ms" },
      { step: "05", node: "Merchant API Delivery", desc: "Zero dropped webhooks despite 50x traffic surge", latency: "18ms Total" },
    ],
    aiStatus: {
      xgboost: "GPU Batched Acceleration",
      lstm: "Standby / Monitoring",
      keda: "MAX SCALED (5/5 GPU Pods)",
      inference: "Triton GPU 80GB (310W)",
    },
    metrics: {
      sla: "99.995%",
      recoveryRate: "100% Stream Handled",
      avgLatency: "18ms",
      computeMode: "NVIDIA H100 GPU Cluster",
    },
  },
  outage: {
    id: "outage",
    title: "Database Lock / Server Outage Scenario",
    badge: "AI INTERCEPTION & RECOVERY",
    badgeColor: "var(--red)",
    description: "Target server database lock or severe hardware outage. XGBoost flags high anomaly score (>0.85). Payloads are intercepted into Celery Vault before retry failure.",
    flowSteps: [
      { step: "01", node: "Payment Gateways", desc: "Payload arrives while merchant DB is locked", latency: "0ms" },
      { step: "02", node: "XGBoost Anomaly Triage", desc: "Flags anomaly score 0.941 → Halts direct pass", latency: "4ms" },
      { step: "03", node: "LSTM Recovery Engine", desc: "Calculates target DB recovery window (450ms target)", latency: "12ms" },
      { step: "04", node: "Celery Vault Enqueue", desc: "Encrypts & holds payload in distributed Redis queue", latency: "18ms" },
      { step: "05", node: "Smart Retry Execution", desc: "Replays payload exactly when target DB recovers", latency: "Recovered (100%)" },
    ],
    aiStatus: {
      xgboost: "INTERCEPTING (Score: 0.941)",
      lstm: "ACTIVE (Predicting Window)",
      keda: "Maintaining Workers",
      inference: "CPU High-Priority Worker",
    },
    metrics: {
      sla: "100% Protected",
      recoveryRate: "99.8% Recovered",
      avgLatency: "450ms Target Window",
      computeMode: "Resilient Task Vault",
    },
  },
  latency: {
    id: "latency",
    title: "Network Congestion & Latency Scenario",
    badge: "LSTM RETRY RESCHEDULING",
    badgeColor: "var(--amber)",
    description: "Network latency spikes >500ms. Standard exponential backoff causes thundering herd problems. LSTM dynamically recalculates optimal retry slots.",
    flowSteps: [
      { step: "01", node: "Payment Gateways", desc: "Webhooks experiencing 700ms+ network delay", latency: "0ms" },
      { step: "02", node: "XGBoost Anomaly Triage", desc: "Identifies severe latency degradation pattern", latency: "4ms" },
      { step: "03", node: "LSTM Time-Series Model", desc: "Predicts network congestion decay curve", latency: "15ms" },
      { step: "04", node: "Adaptive Retry Schedule", desc: "Schedules retry for optimal window (avoiding thundering herd)", latency: "Scheduled" },
      { step: "05", node: "Guaranteed Delivery", desc: "Payload delivered seamlessly post-congestion", latency: "Zero Data Loss" },
    ],
    aiStatus: {
      xgboost: "LATENCY FLAGGED (>500ms)",
      lstm: "ACTIVE (Backoff Optimization)",
      keda: "Worker Scaling",
      inference: "LSTM Recurrent Network",
    },
    metrics: {
      sla: "99.98%",
      recoveryRate: "100% Recovered",
      avgLatency: "Adaptive Schedule",
      computeMode: "LSTM Time-Series Engine",
    },
  },
  nighttime: {
    id: "nighttime",
    title: "Off-Peak Nighttime Scaling Scenario",
    badge: "CPU FALLBACK & COST SAVINGS",
    badgeColor: "var(--purple)",
    description: "Off-peak low traffic (<50 TPS). Unnecessary nodes are bypassed. KEDA scales GPU pods to 0. Direct flow runs on CPU fallback from TrustSync AI Ingress to Merchant API.",
    flowSteps: [
      { step: "01", node: "Payment Gateways", desc: "Low off-peak ingress traffic (10–30 TPS)", latency: "0ms" },
      { step: "02", node: "KEDA Idle Monitor", desc: "Detects low load → Powers down 100% GPU pods to 0", latency: "Instant" },
      { step: "03", node: "CPU Fallback Ingress", desc: "TrustSync AI runs lightweight C++ binary on CPU", latency: "3ms" },
      { step: "04", node: "Direct Pass Delivery", desc: "Direct route to Merchant API (Bypassing GPU/LSTM)", latency: "10ms" },
      { step: "05", node: "Max Infrastructure Savings", desc: "Saves $0.08/min in GPU compute while maintaining SLA", latency: "Max Efficiency" },
    ],
    aiStatus: {
      xgboost: "CPU Fallback Active",
      lstm: "Bypassed / Idle",
      keda: "GPU PODS SCALED TO 0",
      inference: "CPU Host Only (0 GPU VRAM)",
    },
    metrics: {
      sla: "100% Available",
      recoveryRate: "100% Direct Pass",
      avgLatency: "10ms",
      computeMode: "CPU Fallback (45W Idle)",
    },
  },
};

export default function ArchitecturePage() {
  const { faultMode, setFaultMode, setTps, sendWebhook } = useCluster();
  const detail = MODES_CONFIG[faultMode];

  const handleSelectMode = (modeId: FaultMode) => {
    setFaultMode(modeId);
    if (modeId === "spike") setTps(5000);
    else if (modeId === "nighttime") setTps(10);
    else if (modeId === "none") setTps(120);
    else if (modeId === "outage" || modeId === "latency") setTps(350);
  };

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0, marginBottom: 4 }}>
            System Architecture & Flow Topology
          </h1>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>
            Interactive end-to-end component graph showing how TrustSync.AI routes, triages, and recovers webhooks across operational scenarios.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => sendWebhook()}>
          ▶ Trigger Webhook in {faultMode.toUpperCase()} Mode
        </button>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>
          Select System Scenario:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {(Object.keys(MODES_CONFIG) as FaultMode[]).map(mKey => {
            const conf = MODES_CONFIG[mKey];
            const isSel = faultMode === mKey;
            return (
              <button
                key={mKey}
                onClick={() => handleSelectMode(mKey)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${isSel ? conf.badgeColor : "var(--border2)"}`,
                  background: isSel ? `${conf.badgeColor}18` : "var(--bg)",
                  color: isSel ? "var(--white)" : "var(--text2)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all .2s",
                  boxShadow: isSel ? `0 0 20px -4px ${conf.badgeColor}40` : "none",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: conf.badgeColor, fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
                  {conf.badge}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{conf.title.split(" ")[0]} Mode</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Architecture SVG (62%) + Scenario Deep Dive (38%) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>

        {/* Left Column: Interactive Topology Canvas */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 2 }}>
                Live Visual Topology Graph & Animated Packet Flow
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Active path illuminated for <strong style={{ color: detail.badgeColor }}>{detail.title}</strong>
              </div>
            </div>
            <span className="badge" style={{ background: `${detail.badgeColor}18`, color: detail.badgeColor, border: `1px solid ${detail.badgeColor}33` }}>
              ● {faultMode.toUpperCase()} MODE ACTIVE
            </span>
          </div>

          {/* Interactive Flow Diagram Component with Animated Dots */}
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <ArchitectureCanvas mode={faultMode} />
          </div>

          {/* Performance Summary Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, background: "var(--bg)", padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>AI Ingress Latency</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "JetBrains Mono, monospace" }}>2ms — 4ms</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Compute Mode</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: detail.badgeColor, fontFamily: "JetBrains Mono, monospace" }}>{detail.metrics.computeMode}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Zero Loss SLA</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", fontFamily: "JetBrains Mono, monospace" }}>{detail.metrics.sla}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Scenario Breakdown & Flow Execution Steps */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
            <span className="badge" style={{ background: `${detail.badgeColor}18`, color: detail.badgeColor, border: `1px solid ${detail.badgeColor}33`, marginBottom: 8 }}>
              {detail.badge}
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--white)", margin: "4px 0 6px" }}>{detail.title}</h2>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0, lineHeight: 1.5 }}>{detail.description}</p>
          </div>

          {/* Step-by-Step Execution Path */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
              Scenario Execution Path:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.flowSteps.map((step, idx) => (
                <div key={idx} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: detail.badgeColor, fontFamily: "JetBrains Mono, monospace", background: `${detail.badgeColor}18`, padding: "3px 8px", borderRadius: 6 }}>
                    {step.step}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--white)" }}>{step.node}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{step.desc}</div>
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text2)", whiteSpace: "nowrap" }}>
                    {step.latency}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Model Behaviors */}
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginBottom: 8 }}>
              Active Engine Behaviors:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>XGBoost Triage:</span>
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>{detail.aiStatus.xgboost}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>LSTM Predictor:</span>
                <span style={{ color: "var(--amber)", fontWeight: 700 }}>{detail.aiStatus.lstm}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>KEDA Pod Scaler:</span>
                <span style={{ color: "var(--purple)", fontWeight: 700 }}>{detail.aiStatus.keda}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── High-Definition SVG Architecture Canvas with Animated Flow Dots ─────────────
interface PktArch {
  id: string;
  pathX: number[];
  pathY: number[];
  color: string;
}

let archUid = 0;

function ArchitectureCanvas({ mode }: { mode: FaultMode }) {
  const [packets, setPackets] = useState<PktArch[]>([]);
  const removeArchPkt = useCallback((id: string) => setPackets(p => p.filter(x => x.id !== id)), []);

  const isNight = mode === "nighttime";
  const isSpike = mode === "spike";
  const isAnomaly = mode === "outage" || mode === "latency";

  // Coordinates for canvas (viewBox 720 × 400)
  const P_GW      = { x: 360, y: 34 };
  const P_AI      = { x: 360, y: 114 };
  const P_GPU     = { x: 125, y: 114 };
  const P_TRIAGE  = { x: 360, y: 200 };
  const P_DIRECT  = { x: 180, y: 282 };
  const P_LSTM    = { x: 540, y: 282 };
  const P_CELERY  = { x: 540, y: 360 };
  const P_MERCHANT= { x: 335, y: 360 };

  // Clear packets when mode changes
  useEffect(() => {
    setPackets([]);
  }, [mode]);

  // Spawn packets along active mode paths
  useEffect(() => {
    const id = setInterval(() => {
      setPackets(prev => {
        if (prev.length >= 10) return prev;

        let pathX: number[] = [];
        let pathY: number[] = [];
        let color = "#3b82f6";

        if (isNight) {
          // Off-Peak: Gateways → AI Ingress → Direct Pass (via curve) → Merchant Target
          pathX = [P_GW.x, P_AI.x, 310, 250, 200, 180, P_DIRECT.x, 235, 290, P_MERCHANT.x];
          pathY = [P_GW.y, P_AI.y, 120, 145, 195, 260, P_DIRECT.y, 318, 338, P_MERCHANT.y];
          color = "#22c55e";
        } else if (isSpike) {
          // Spike: Gateways → AI Ingress → GPU Cluster → AI Ingress → XGBoost → Direct Pass (via curve) → Merchant
          pathX = [P_GW.x, P_AI.x, P_GPU.x, P_AI.x, P_TRIAGE.x, 310, 265, 215, 180, P_DIRECT.x, 235, 290, P_MERCHANT.x];
          pathY = [P_GW.y, P_AI.y, P_GPU.y, P_AI.y, P_TRIAGE.y, 200, 213, 233, 260, P_DIRECT.y, 318, 338, P_MERCHANT.y];
          color = "#3b82f6";
        } else if (isAnomaly) {
          // Anomaly: Gateways → AI Ingress → XGBoost → LSTM (via curve) → Celery → Merchant Target
          pathX = [P_GW.x, P_AI.x, P_TRIAGE.x, 410, 455, 505, 540, P_LSTM.x, P_CELERY.x, 480, 420, P_MERCHANT.x];
          pathY = [P_GW.y, P_AI.y, P_TRIAGE.y, 200, 213, 233, 260, P_LSTM.y, P_CELERY.y, 360, 360, P_MERCHANT.y];
          color = "#f59e0b";
        } else {
          // Normal: Gateways → AI Ingress → XGBoost → Direct Pass (via curve) → Merchant Target
          pathX = [P_GW.x, P_AI.x, P_TRIAGE.x, 310, 265, 215, 180, P_DIRECT.x, 235, 290, P_MERCHANT.x];
          pathY = [P_GW.y, P_AI.y, P_TRIAGE.y, 200, 213, 233, 260, P_DIRECT.y, 318, 338, P_MERCHANT.y];
          color = "#22c55e";
        }

        const pkt: PktArch = { id: `ap_${++archUid}`, pathX, pathY, color };
        return [...prev, pkt];
      });
    }, 700);

    return () => clearInterval(id);
  }, [mode, isNight, isSpike, isAnomaly]);

  const activeSet: Record<FaultMode, Set<string>> = {
    none: new Set(["n-gw", "n-ai", "n-triage", "n-direct", "n-merchant", "e-gw-ai", "e-ai-triage", "e-triage-direct", "e-direct-merchant"]),
    spike: new Set(["n-gw", "n-ai", "n-triage", "n-direct", "n-merchant", "n-gpu", "e-gw-ai", "e-ai-triage", "e-triage-direct", "e-direct-merchant", "e-gpu-ai"]),
    outage: new Set(["n-gw", "n-ai", "n-triage", "n-lstm", "n-celery", "n-merchant", "e-gw-ai", "e-ai-triage", "e-triage-lstm", "e-lstm-celery", "e-celery-merchant"]),
    latency: new Set(["n-gw", "n-ai", "n-triage", "n-lstm", "n-celery", "n-merchant", "e-gw-ai", "e-ai-triage", "e-triage-lstm", "e-lstm-celery", "e-celery-merchant"]),
    nighttime: new Set(["n-gw", "n-ai", "n-direct", "n-merchant", "e-gw-ai", "e-ai-direct", "e-direct-merchant"]),
  };

  const getOp = (id: string) => (activeSet[mode].has(id) ? 1 : 0.08);

  return (
    <svg viewBox="0 0 720 400" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Connectors (Edges) ── */}
      {/* GW → AI Ingress */}
      <g opacity={getOp("e-gw-ai")} style={{ transition: "opacity .35s" }}>
        <line x1="360" y1="52" x2="360" y2="92" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="4 4" />
      </g>

      {!isNight && (
        <>
          {/* AI → XGBoost */}
          <g opacity={getOp("e-ai-triage")} style={{ transition: "opacity .35s" }}>
            <line x1="360" y1="136" x2="360" y2="176" stroke="#3b82f6" strokeWidth="2.5" />
          </g>

          {/* Direct Pass Branch (Left) */}
          <g opacity={getOp("e-triage-direct")} style={{ transition: "opacity .35s" }}>
            <path d="M 310 200 Q 200 230 180 260" stroke="#22c55e" strokeWidth="2.5" fill="none" />
            <text x="210" y="222" fill="#22c55e" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">Normal (Score &lt; 0.05)</text>
          </g>
          <g opacity={getOp("e-direct-merchant")} style={{ transition: "opacity .35s" }}>
            <line x1="180" y1="304" x2="300" y2="345" stroke="#22c55e" strokeWidth="2.5" />
          </g>

          {/* Anomaly Interception Branch (Right) */}
          <g opacity={getOp("e-triage-lstm")} style={{ transition: "opacity .35s" }}>
            <path d="M 410 200 Q 520 230 540 260" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
            <text x="440" y="222" fill="#f59e0b" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">Anomaly (Score &gt; 0.85)</text>
          </g>
          <g opacity={getOp("e-lstm-celery")} style={{ transition: "opacity .35s" }}>
            <line x1="540" y1="304" x2="540" y2="340" stroke="#f59e0b" strokeWidth="2.5" />
          </g>
          <g opacity={getOp("e-celery-merchant")} style={{ transition: "opacity .35s" }}>
            <line x1="480" y1="360" x2="420" y2="360" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="3 3" />
          </g>
        </>
      )}

      {/* Off-Peak Night Connectors (Direct from AI Ingress → Direct Pass → Merchant Target) */}
      {isNight && (
        <>
          <g opacity={getOp("e-ai-direct")} style={{ transition: "opacity .35s" }}>
            <path d="M 310 120 Q 180 180 180 260" stroke="#22c55e" strokeWidth="2.5" fill="none" />
            <text x="210" y="180" fill="#22c55e" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">CPU Fallback Direct</text>
          </g>
          <g opacity={getOp("e-direct-merchant")} style={{ transition: "opacity .35s" }}>
            <line x1="180" y1="304" x2="300" y2="345" stroke="#22c55e" strokeWidth="2.5" />
          </g>
        </>
      )}

      {/* GPU scaling connector */}
      {isSpike && (
        <g opacity={1}>
          <line x1="200" y1="114" x2="270" y2="114" stroke="#3b82f6" strokeWidth="2.5" />
        </g>
      )}

      {/* ── Animated Packet Dots ── */}
      {packets.map(pkt => (
        <motion.circle
          key={pkt.id}
          r={5}
          fill={pkt.color}
          style={{ filter: `drop-shadow(0 0 6px ${pkt.color})` }}
          initial={{ cx: pkt.pathX[0], cy: pkt.pathY[0], opacity: 0 }}
          animate={{ cx: pkt.pathX, cy: pkt.pathY, opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: 3.2, ease: "easeInOut" }}
          onAnimationComplete={() => removeArchPkt(pkt.id)}
        />
      ))}

      {/* ── Node 1: Payment Gateways ── */}
      <g opacity={getOp("n-gw")} style={{ transition: "opacity .35s" }}>
        <rect x="230" y="16" width="260" height="36" rx="10" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
        <text x="360" y="30" textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono, monospace">PAYMENT GATEWAYS INGRESS</text>
        <text x="360" y="43" textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="8.5" fontFamily="Inter, sans-serif">Stripe · bKash · SSLCommerz</text>
      </g>

      {/* ── Node 2: AI Ingress ── */}
      <g opacity={getOp("n-ai")} style={{ transition: "opacity .35s" }}>
        <rect x="270" y="92" width="180" height="44" rx="10" fill="#1e1b4b" stroke={isNight ? "#22c55e" : "#8b5cf6"} strokeWidth="2" />
        <text x="360" y="107" textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono, monospace">TRUSTSYNC AI INGEST</text>
        <text x="360" y="122" textAnchor="middle" dominantBaseline="central" fill={isNight ? "#4ade80" : "#c084fc"} fontSize="8.5" fontFamily="Inter, sans-serif">
          {isNight ? "CPU Fallback (GPU 0)" : "Gateway & Rate Limiter"}
        </text>
      </g>

      {/* GPU Pod Node for Spike Mode */}
      {isSpike && (
        <g opacity={1}>
          <rect x="50" y="94" width="150" height="40" rx="8" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" filter="url(#glowBlue)" />
          <text x="125" y="108" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="10.5" fontWeight="800" fontFamily="JetBrains Mono, monospace">TRITON GPU (5 PODS)</text>
          <text x="125" y="122" textAnchor="middle" dominantBaseline="central" fill="#93c5fd" fontSize="8.5" fontFamily="Inter, sans-serif">NVIDIA H100 Accelerated</text>
        </g>
      )}

      {!isNight && (
        <>
          {/* ── Node 3: XGBoost Triage ── */}
          <g opacity={getOp("n-triage")} style={{ transition: "opacity .35s" }}>
            <rect x="250" y="176" width="220" height="48" rx="10" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
            <text x="360" y="193" textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize="12" fontWeight="800" fontFamily="JetBrains Mono, monospace">XGBOOST ANOMALY TRIAGE</text>
            <text x="360" y="209" textAnchor="middle" dominantBaseline="central" fill="#60a5fa" fontSize="8.5" fontFamily="Inter, sans-serif">Sub-4ms Anomaly Score Filter</text>
          </g>

          {/* ── Node 5: LSTM Predictor (Right) ── */}
          <g opacity={getOp("n-lstm")} style={{ transition: "opacity .35s" }}>
            <rect x="460" y="260" width="160" height="44" rx="10" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
            <text x="540" y="276" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="10.5" fontWeight="800" fontFamily="JetBrains Mono, monospace">LSTM PREDICTOR</text>
            <text x="540" y="291" textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize="8.5" fontFamily="Inter, sans-serif">Recovery Window Model</text>
          </g>

          {/* ── Node 6: Celery Queue ── */}
          <g opacity={getOp("n-celery")} style={{ transition: "opacity .35s" }}>
            <rect x="480" y="340" width="120" height="40" rx="8" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
            <text x="540" y="354" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="10" fontWeight="800" fontFamily="JetBrains Mono, monospace">CELERY VAULT</text>
            <text x="540" y="367" textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize="8" fontFamily="Inter, sans-serif">Smart Replay Queue</text>
          </g>
        </>
      )}

      {/* ── Node 4: Direct Pass (Left) ── */}
      <g opacity={getOp("n-direct")} style={{ transition: "opacity .35s" }}>
        <rect x="100" y="260" width="160" height="44" rx="10" fill="#064e3b" stroke="#22c55e" strokeWidth="2" />
        <text x="180" y="276" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="10.5" fontWeight="800" fontFamily="JetBrains Mono, monospace">DIRECT PASS</text>
        <text x="180" y="291" textAnchor="middle" dominantBaseline="central" fill="#4ade80" fontSize="8.5" fontFamily="Inter, sans-serif">
          {isNight ? "CPU Direct Route" : "14ms · 200 OK Delivery"}
        </text>
      </g>

      {/* ── Node 7: Merchant API Target ── */}
      <g opacity={getOp("n-merchant")} style={{ transition: "opacity .35s" }}>
        <rect x="250" y="338" width="170" height="44" rx="10" fill="#064e3b" stroke="#22c55e" strokeWidth="2.5" filter={isAnomaly ? "url(#glowGreen)" : ""} />
        <text x="335" y="354" textAnchor="middle" dominantBaseline="central" fill="#ffffff" fontSize="11" fontWeight="800" fontFamily="JetBrains Mono, monospace">MERCHANT API TARGET</text>
        <text x="335" y="368" textAnchor="middle" dominantBaseline="central" fill="#4ade80" fontSize="8.5" fontFamily="Inter, sans-serif">✓ Guaranteed Zero Loss</text>
      </g>
    </svg>
  );
}
