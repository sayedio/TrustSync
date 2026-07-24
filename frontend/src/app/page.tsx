"use client";
import { useEffect, useState, useRef } from "react";
import { useCluster, WebhookEvent } from "@/context/ClusterContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import SimulationFlow from "@/components/SimulationFlow";

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const diff = value - prev.current;
    const steps = 8;
    let step = 0;
    const id = setInterval(() => {
      step++;
      setDisplay(prev.current + (diff * step) / steps);
      if (step >= steps) { clearInterval(id); prev.current = value; }
    }, 20);
    return () => clearInterval(id);
  }, [value]);
  return <span className="mono">{prefix}{display.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, accent, prefix = "", decimals = 0 }: { label: string; value: number; sub: string; accent: string; prefix?: string; decimals?: number }) {
  return (
    <div className="card" style={{ borderColor: `${accent}22` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>
        <Counter value={value} prefix={prefix} decimals={decimals} />
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}

// ─── Webhook status metadata ────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  delivered: { color: "#22c55e", bg: "rgba(34,197,94,.08)",  label: "✓ DELIVERED" },
  queued:    { color: "#f59e0b", bg: "rgba(245,158,11,.08)", label: "⏳ QUEUED" },
  recovered: { color: "#3b82f6", bg: "rgba(59,130,246,.08)", label: "↺ RECOVERED" },
  failed:    { color: "#ef4444", bg: "rgba(239,68,68,.08)",  label: "✗ FAILED" },
};
const GW_COLORS: Record<string, string> = { Stripe: "#635BFF", bKash: "#E91E8C", SSLCommerz: "#F59E0B" };

// ─── Minimal Webhook Resolution Modal ─────────────────────────────────────────
function WebhookResolutionModal({ event, onClose }: { event: WebhookEvent; onClose: () => void }) {
  const meta = STATUS_COLORS[event.status];

  let resolutionMsg = "";
  let badgeLabel = "";

  if (event.status === "recovered") {
    badgeLabel = "RECOVERED & PROCESSED";
    resolutionMsg = `TrustSync AI intercepted this payment during target server failure. Once the target server recovered, the system replayed the payload. The amount of ${event.currency} ${event.amount} has been verified and processed directly to the user's merchant account.`;
  } else if (event.status === "queued") {
    badgeLabel = "HELD IN CELERY VAULT";
    resolutionMsg = `Target server is currently unavailable. The payment of ${event.currency} ${event.amount} is safely held in the Celery Vault. TrustSync AI's LSTM engine is monitoring the target recovery window to replay this transaction automatically.`;
  } else if (event.status === "failed") {
    badgeLabel = "RECOVERY FAILED — REFUNDED";
    resolutionMsg = `The target server returned a 500 error and no AI recovery model was active. Because the webhook could not be delivered, the transaction of ${event.currency} ${event.amount} was canceled and money has been automatically sent back to the user's account.`;
  } else {
    badgeLabel = "DIRECT PASS SUCCESS";
    resolutionMsg = `Normal baseline traffic. The payment of ${event.currency} ${event.amount} passed XGBoost anomaly triage with a clean score of ${event.anomalyScore.toFixed(3)} and was delivered directly to the merchant API in ${event.latencyMs}ms.`;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        style={{
          background: "var(--surface)", border: `1px solid ${meta.color}44`, borderRadius: 16,
          width: "100%", maxWidth: 480, overflow: "hidden", boxShadow: `0 0 40px ${meta.color}22, 0 12px 40px rgba(0,0,0,0.8)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ height: 4, background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span className="badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33`, marginBottom: 6 }}>
                ● {badgeLabel}
              </span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--white)", margin: "6px 0 2px" }}>
                Webhook Resolution Report
              </h2>
              <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--text2)" }}>{event.id}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 20 }}>×</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, background: "var(--bg)", padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Transaction Amount</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--white)", fontFamily: "JetBrains Mono, monospace" }}>{event.currency} {event.amount}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Latency</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "JetBrains Mono, monospace" }}>{event.latencyMs}ms</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Anomaly Score</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: meta.color, fontFamily: "JetBrains Mono, monospace" }}>{event.anomalyScore.toFixed(3)}</div>
            </div>
          </div>

          <div style={{ background: meta.bg, border: `1px solid ${meta.color}33`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: meta.color, marginBottom: 6 }}>
              Human-Readable Audit Explanation
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
              {resolutionMsg}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary" onClick={onClose} style={{ padding: "8px 18px", fontSize: 12 }}>
              Close Window
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Webhook response toast ────────────────────────────────────────────────────
function WebhookToast({ event, onDismiss, onClick }: { event: WebhookEvent; onDismiss: () => void; onClick: () => void }) {
  const meta = STATUS_COLORS[event.status];
  useEffect(() => { const id = setTimeout(onDismiss, 9000); return () => clearTimeout(id); }, [onDismiss]);

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 260 }}
      onClick={onClick}
      style={{
        position: "fixed", right: 24, bottom: 24, width: 320,
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 14, overflow: "hidden", zIndex: 500, cursor: "pointer",
        boxShadow: `0 0 30px ${meta.color}22, 0 8px 32px rgba(0,0,0,.6)`,
      }}
    >
      {/* top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${meta.color}, transparent)` }} />

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, marginBottom: 3 }}>{meta.label} <span style={{ fontSize: 9, opacity: 0.7 }}> (Click for report)</span></div>
            <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text2)" }}>{event.id}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: GW_COLORS[event.gateway] }}>{event.gateway}</span>
            <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
          {[
            { label: "Amount",  value: `${event.currency} ${event.amount}` },
            { label: "Latency", value: `${event.latencyMs}ms` },
            { label: "Score",   value: event.anomalyScore.toFixed(3) },
          ].map(m => (
            <div key={m.label} style={{ background: "var(--bg)", borderRadius: 7, padding: "6px 8px" }}>
              <div style={{ fontSize: 8, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", color: "var(--text)" }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* AI decision */}
        <div style={{ background: meta.bg, border: `1px solid ${meta.color}22`, borderRadius: 8, padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>AI Decision</div>
          <div style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: meta.color }}>
            {event.payload.ai_action as string}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Pipeline visualization ────────────────────────────────────────────────────
function PipelineViz({ faultMode }: { faultMode: string }) {
  const isNight = faultMode === "nighttime";
  const degraded = faultMode === "outage" || faultMode === "latency";
  const isSpike = faultMode === "spike";

  const steps = isNight ? [
    { label: "Payment Gateways", sub: "Ingress Payload Stream", color: "var(--blue)" },
    { label: "TrustSync AI Ingest", sub: "CPU Fallback (GPU 0)", color: "var(--green)" },
    { label: "Merchant API Target", sub: "Direct Pass (10ms)", color: "var(--green)" },
  ] : degraded ? [
    { label: "Payment Gateways", sub: "Ingress Payload Stream", color: "var(--blue)" },
    { label: "XGBoost Anomaly Triage", sub: "Score > 0.85 (Outage/Delay)", color: "var(--red)" },
    { label: "LSTM Predictor", sub: "450ms Target Window", color: "var(--amber)" },
    { label: "Celery Smart Vault", sub: "100% Payload Recovered ✓", color: "var(--green)" },
  ] : isSpike ? [
    { label: "Payment Gateways", sub: "5,000 TPS Surge", color: "var(--blue)" },
    { label: "Triton GPU Cluster", sub: "5 Pods Accelerated", color: "var(--blue)" },
    { label: "Merchant API Target", sub: "High-Throughput Pass", color: "var(--green)" },
  ] : [
    { label: "Payment Gateways", sub: "Stripe · bKash · SSLCommerz", color: "var(--blue)" },
    { label: "TrustSync AI Core", sub: "XGBoost Anomaly Triage", color: "var(--purple)" },
    { label: "Merchant API Target", sub: "Direct Fast-Pass (14ms)", color: "var(--green)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((step, i) => (
        <div key={i}>
          <div style={{ background: "var(--bg)", border: `1px solid ${step.color}44`, borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: step.color, marginBottom: 2 }}>{step.label}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{step.sub}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
              <div style={{ width: 1, height: 10, background: `${steps[i + 1].color}55` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Log filter tags ───────────────────────────────────────────────────────────
type LogEntry = { time: string; msg: string; level: "info" | "warn" | "error" | "success"; tag: string };
const levelColor = { info: "var(--blue)", warn: "var(--amber)", error: "var(--red)", success: "var(--green)" };

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MissionControl() {
  const { tps, totalWebhooks, recovered, savings, faultMode, inferenceMode, sendWebhook, lastEvent, clearLastEvent } = useCluster();
  const [chart, setChart] = useState([{ t: 0, tps: 0, recovered: 0 }]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState("ALL");
  const [showToast, setShowToast] = useState(false);
  const [toastEvent, setToastEvent] = useState<WebhookEvent | null>(null);
  const [modalEvent, setModalEvent] = useState<WebhookEvent | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const prevLastEvent = useRef<WebhookEvent | null>(null);

  // Chart: grows naturally from t=0
  useEffect(() => {
    const id = setInterval(() => {
      setChart(prev => {
        const point = { t: prev.length, tps, recovered: faultMode !== "none" ? Math.floor(tps * 0.88) : 0 };
        return [...prev, point].slice(-35);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [tps, faultMode]);

  // Log stream
  useEffect(() => {
    if (tps === 0) return;
    const id = setInterval(() => {
      const now = new Date().toTimeString().slice(0, 8);
      let entry: LogEntry;
      if (faultMode === "outage")    entry = { time: now, msg: "XGBoost triage: DB lock → payload intercepted → Celery queue.", level: "error", tag: "XGBOOST" };
      else if (faultMode === "latency") entry = { time: now, msg: "LSTM: Latency anomaly >500ms. Adjusting retry window to 450ms.", level: "warn", tag: "LSTM" };
      else if (faultMode === "spike")   entry = { time: now, msg: `KEDA: Traffic surge (${tps} TPS). Provisioning Triton GPU nodes.`, level: "info", tag: "KEDA" };
      else if (faultMode === "nighttime") entry = { time: now, msg: "KEDA: TPS < 50. Scaling Triton to 0 pods. CPU fallback active.", level: "info", tag: "KEDA" };
      else entry = { time: now, msg: `Gateway: ${Math.ceil(tps / 5)} webhooks delivered direct. Anomaly score < 0.05.`, level: "success", tag: "GATEWAY" };
      setLogs(prev => [...prev.slice(-60), entry]);
    }, 1000);
    return () => clearInterval(id);
  }, [tps, faultMode]);

  // Auto-scroll logs
  useEffect(() => { logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: "smooth" }); }, [logs]);

  // Show toast when lastEvent changes
  useEffect(() => {
    if (lastEvent && lastEvent !== prevLastEvent.current) {
      prevLastEvent.current = lastEvent;
      setToastEvent(lastEvent);
      setShowToast(true);
    }
  }, [lastEvent]);

  const handleDismissToast = () => {
    setShowToast(false);
    clearLastEvent();
  };

  const TAGS = ["ALL", "XGBOOST", "LSTM", "KEDA", "GATEWAY"];
  const filteredLogs = logFilter === "ALL" ? logs : logs.filter(l => l.tag === logFilter);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0, marginBottom: 3 }}>Mission Control</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>Real-time webhook ingress · AI failure interception · cluster telemetry</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {(["Stripe","bKash","SSLCommerz"] as const).map(gw => (
            <button key={gw} onClick={() => sendWebhook(gw)} className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 12px", color: GW_COLORS[gw], borderColor: `${GW_COLORS[gw]}33` }}>
              ▶ {gw}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KPI label="Traffic Load" value={tps} sub={tps === 0 ? "Idle — set TPS in Chaos Lab" : "Transactions / second"} accent="var(--blue)" />
        <KPI label="Total Webhooks" value={totalWebhooks} sub="Since cluster start" accent="var(--purple)" />
        <KPI label="AI Recovered" value={recovered} sub="Prevented lost revenue" accent="var(--amber)" />
        <KPI label="Saved Revenue" value={savings} sub="Zero lost transactions" accent="var(--green)" prefix="$" decimals={2} />
      </div>

      {/* Pipeline + Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Live Routing Pipeline</div>
          <PipelineViz faultMode={faultMode} />
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.8, marginTop: 4 }}>
            Inference: <span style={{ color: inferenceMode === "gpu" ? "var(--green)" : "var(--blue)", fontWeight: 700 }}>{inferenceMode === "gpu" ? "Triton GPU" : "CPU Fallback"}</span><br />
            E2E Latency: <span style={{ color: "var(--text)", fontWeight: 700 }}>{faultMode !== "none" ? "300–900ms" : "12–38ms"}</span>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 14 }}>Ingress TPS vs. AI Recovery Rate</div>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c1c1c" vertical={false} />
                <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0f0f0f", border: "1px solid #1c1c1c", borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                  labelFormatter={() => ""}
                />
                <Area type="monotone" dataKey="tps" stroke="#3b82f6" strokeWidth={2} fill="url(#gTps)" name="Ingress TPS" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="recovered" stroke="#f59e0b" strokeWidth={2} fill="url(#gRec)" name="AI Recovered" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {tps === 0 && (
            <div style={{ textAlign: "center", padding: "8px 0 0", fontSize: 11, color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>
              Set TPS &gt; 0 in Chaos Lab or use the slider in the sidebar to start the chart
            </div>
          )}
        </div>
      </div>

      {/* ── SIMULATION FLOW SECTION ── */}
      <div className="card">
        <SimulationFlow />
      </div>

      {/* Terminal log */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>⬢</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", fontFamily: "JetBrains Mono, monospace" }}>cluster.log</span>
            {tps > 0 && <span className="pulse-dot green" />}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {TAGS.map(tag => (
              <button key={tag} onClick={() => setLogFilter(tag)} style={{
                padding: "2px 9px", borderRadius: 5, fontSize: 9, fontWeight: 700,
                fontFamily: "JetBrains Mono, monospace", letterSpacing: ".06em",
                background: logFilter === tag ? "var(--blue)" : "transparent",
                color: logFilter === tag ? "white" : "var(--muted)",
                border: `1px solid ${logFilter === tag ? "var(--blue)" : "var(--border2)"}`,
                cursor: "pointer",
              }}>{tag}</button>
            ))}
          </div>
        </div>
        <div ref={logsRef} style={{ height: 160, overflowY: "auto", padding: "10px 18px", background: "#050505", display: "flex", flexDirection: "column", gap: 3 }}>
          {filteredLogs.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 11, fontFamily: "JetBrains Mono, monospace", margin: "auto" }}>
              {tps === 0 ? "Cluster idle — increase TPS to start logging" : "No events for this filter..."}
            </div>
          ) : filteredLogs.map((log, i) => (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "JetBrains Mono, monospace", lineHeight: 1.5 }}>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{log.time}</span>
              <span style={{ color: levelColor[log.level], fontWeight: 700, minWidth: 64, flexShrink: 0 }}>[{log.tag}]</span>
              <span style={{ color: "var(--text2)" }}>{log.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Toast Popup */}
      <AnimatePresence>
        {showToast && toastEvent && (
          <WebhookToast
            key={toastEvent.id}
            event={toastEvent}
            onDismiss={handleDismissToast}
            onClick={() => setModalEvent(toastEvent)}
          />
        )}
      </AnimatePresence>

      {/* Webhook Resolution Modal */}
      <AnimatePresence>
        {modalEvent && (
          <WebhookResolutionModal event={modalEvent} onClose={() => setModalEvent(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
