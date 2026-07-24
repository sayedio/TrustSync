"use client";
import { useState } from "react";
import { useCluster, FaultMode } from "@/context/ClusterContext";
import { motion, AnimatePresence } from "framer-motion";

interface Experiment {
  id: FaultMode;
  icon: string;
  name: string;
  description: string;
  impact: string;
  accentColor: string;
  tpsOverride?: number;
}

const EXPERIMENTS: Experiment[] = [
  {
    id: "none",
    icon: "🟢",
    name: "Baseline Normal Operation",
    description: "Restores standard baseline operational flow. Webhooks pass through XGBoost anomaly triage with 14ms direct-pass delivery.",
    impact: "Normal operational mode (Anomaly score < 0.05)",
    accentColor: "#22c55e",
    tpsOverride: 120,
  },
  {
    id: "spike",
    icon: "⚡",
    name: "5,000 TPS Payment Surge",
    description: "Simulates a massive Black Friday-style payment surge. KEDA provisions Triton GPU inference nodes to handle the load.",
    impact: "Triggers GPU scale-up, high throughput mode",
    accentColor: "#3b82f6",
    tpsOverride: 5000,
  },
  {
    id: "outage",
    icon: "🔴",
    name: "Worker Node Hardware Failure",
    description: "Simulates a critical memory leak and DB lock on Node-2. Isolation Forest detects the anomaly and evicts workloads.",
    impact: "AI intercepts all payloads → Celery queue",
    accentColor: "#ef4444",
  },
  {
    id: "nighttime",
    icon: "🌙",
    name: "Off-Peak Nighttime Scaling",
    description: "Simulates low-traffic nighttime conditions (10 TPS). KEDA scales Triton to zero. CPU fallback takes over.",
    impact: "GPU shutdown → Infrastructure cost savings accelerate",
    accentColor: "#8b5cf6",
    tpsOverride: 10,
  },
  {
    id: "latency",
    icon: "⏱️",
    name: "500ms Network Bottleneck",
    description: "Injects high-latency conditions to test LSTM prediction of recovery windows and smart retry backoff behavior.",
    impact: "LSTM adjusts retry schedule in real-time",
    accentColor: "#f59e0b",
  },
];

export default function LabPage() {
  const { faultMode, setFaultMode, setTps, tps } = useCluster();
  const [log, setLog] = useState<string[]>([]);

  const runExperiment = (exp: Experiment) => {
    if (exp.tpsOverride !== undefined) setTps(exp.tpsOverride);
    setFaultMode(exp.id);
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(prev => [`[${ts}] Experiment "${exp.name}" started.`, ...prev.slice(0, 20)]);
  };

  const reset = () => {
    setFaultMode("none");
    setTps(120);
    const ts = new Date().toTimeString().slice(0, 8);
    setLog(prev => [`[${ts}] Cluster baseline restored. Fault: none, TPS: 120.`, ...prev.slice(0, 20)]);
  };

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0, marginBottom: 4 }}>Chaos Lab</h1>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>AWS FIS-style fault injection experiments for SLA validation and resilience testing</p>
        </div>
        <button onClick={reset} className="btn btn-ghost">
          ↺&nbsp; Restore Baseline
        </button>
      </div>

      {/* SLA Scorecard */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Target SLA Availability",    value: "99.99%", color: "var(--green)" },
          { label: "Recovery Time Objective",    value: "< 450ms", color: "var(--blue)" },
          { label: "Chaos Test Score",           value: "100 / 100", color: "var(--green)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Experiments Grid */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 12 }}>Experiment Catalog</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {EXPERIMENTS.map(exp => {
            const isActive = faultMode === exp.id;
            return (
              <div key={exp.id} onClick={() => runExperiment(exp)} style={{
                background: isActive ? `${exp.accentColor}0d` : "var(--surface)",
                border: `1px solid ${isActive ? exp.accentColor + "44" : "var(--border)"}`,
                borderRadius: 14,
                padding: "20px 24px",
                cursor: "pointer",
                transition: "all .2s",
                boxShadow: isActive ? `0 0 20px -4px ${exp.accentColor}40` : "none",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}>
                <div style={{
                  width: 44, height: 44, flexShrink: 0,
                  borderRadius: 10,
                  background: `${exp.accentColor}18`,
                  border: `1px solid ${exp.accentColor}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  {exp.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--white)" }}>{exp.name}</div>
                    {isActive ? (
                      <span className="badge" style={{ background: `${exp.accentColor}18`, color: exp.accentColor, border: `1px solid ${exp.accentColor}33` }}>
                        ● ACTIVE
                      </span>
                    ) : (
                      <span className="badge badge-blue" style={{ cursor: "pointer" }}>RUN TEST</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 8 }}>{exp.description}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: exp.accentColor, fontFamily: "JetBrains Mono, monospace" }}>
                    → {exp.impact}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual TPS Slider + Audit Log */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* TPS Slider */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginBottom: 16 }}>Manual Load Generator</div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 56, fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: tps === 0 ? "var(--muted)" : "var(--white)", lineHeight: 1 }}>
              {tps === 0 ? "IDLE" : tps.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              {tps === 0 ? "No traffic — drag slider to start" : "Transactions Per Second"}
            </div>
          </div>
          <input type="range" min={0} max={5000} step={10} value={tps} onChange={e => setTps(+e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--muted)", marginTop: 6 }}>
            <span>0 (idle)</span>
            <span style={{ color: "var(--blue)" }}>500 → GPU</span>
            <span>5,000</span>
          </div>
          {tps === 0 && (
            <div style={{ marginTop: 12, background: "rgba(255,255,255,.03)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>
              ⏸ Simulation paused. No webhooks are being processed.
            </div>
          )}
          {tps > 0 && tps <= 500 && (
            <div style={{ marginTop: 12, background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--green)", fontFamily: "JetBrains Mono, monospace" }}>
              ✓ CPU inference mode. GPU is idle — cost savings accumulating.
            </div>
          )}
          {tps > 500 && (
            <div style={{ marginTop: 12, background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--blue)", fontFamily: "JetBrains Mono, monospace" }}>
              ⚡ GPU threshold exceeded. Triton provisioning active.
            </div>
          )}
        </div>

        {/* Audit Log */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Experiment Audit Log</span>
          </div>
          <div style={{ padding: "12px 20px", height: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {log.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "JetBrains Mono, monospace", margin: "auto" }}>No experiments run yet...</div>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--text2)", lineHeight: 1.4, paddingBottom: 6, borderBottom: i < log.length - 1 ? "1px solid var(--border)" : "none" }}>{entry}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
