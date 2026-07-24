"use client";
import { useState } from "react";
import { useCluster, WebhookEvent } from "@/context/ClusterContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const BACKOFF_DATA = [
  { attempt: "1st", standard: 5,   ai: 2 },
  { attempt: "2nd", standard: 15,  ai: 9 },
  { attempt: "3rd", standard: 45,  ai: 12 },
  { attempt: "4th", standard: 135, ai: 14 },
  { attempt: "5th", standard: 405, ai: 15 },
];

const STATUS_META: Record<WebhookEvent["status"], { label: string; color: string; bg: string }> = {
  delivered: { label: "DELIVERED",  color: "var(--green)",  bg: "rgba(34,197,94,.08)"  },
  queued:    { label: "QUEUED",     color: "var(--amber)",  bg: "rgba(245,158,11,.08)" },
  recovered: { label: "RECOVERED",  color: "var(--blue)",   bg: "rgba(59,130,246,.08)" },
  failed:    { label: "FAILED",     color: "var(--red)",    bg: "rgba(239,68,68,.08)"  },
};

const GW_COLOR: Record<string, string> = { Stripe: "#635BFF", bKash: "#E91E8C", SSLCommerz: "#F59E0B" };

export default function VaultPage() {
  const { events, replayEvent } = useCluster();
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = statusFilter === "ALL" ? events : events.filter(e => e.status === statusFilter);

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0, marginBottom: 4 }}>Recovery Vault</h1>
        <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>Intercepted webhook payloads, smart retry scheduling, and Celery task queue telemetry</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { label: "Active Celery Workers", value: "24 nodes", color: "var(--green)" },
          { label: "Payloads in Vault", value: `${events.filter(e => e.status === "queued").length}`, color: "var(--amber)" },
          { label: "Load Reduction", value: "68.4%", color: "var(--blue)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "JetBrains Mono, monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Vault Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table header with filters */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>Intercepted Webhook Events</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["ALL", "queued", "recovered", "delivered", "failed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: ".06em",
                fontFamily: "JetBrains Mono, monospace",
                background: statusFilter === s ? "var(--blue)" : "transparent",
                color: statusFilter === s ? "white" : "var(--muted)",
                border: `1px solid ${statusFilter === s ? "var(--blue)" : "var(--border2)"}`,
                cursor: "pointer",
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Payload ID</th>
                <th>Gateway</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Anomaly Score</th>
                <th>Latency</th>
                <th>Retries</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map(event => {
                const meta = STATUS_META[event.status];
                return (
                  <tr key={event.id}>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text2)" }}>{event.id}</span></td>
                    <td>
                      <span style={{ fontWeight: 700, color: GW_COLOR[event.gateway] || "var(--text)", fontSize: 12 }}>{event.gateway}</span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>{event.event}</td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600, color: "var(--text)" }}>{event.currency} {event.amount}</span></td>
                    <td>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: event.anomalyScore > 0.5 ? "var(--red)" : "var(--green)", fontSize: 12 }}>
                        {event.anomalyScore.toFixed(3)}
                      </span>
                    </td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: event.latencyMs > 300 ? "var(--red)" : "var(--text2)" }}>{event.latencyMs}ms</span></td>
                    <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: event.retries > 0 ? "var(--amber)" : "var(--muted)" }}>{event.retries}</span></td>
                    <td>
                      <span className="badge" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>{meta.label}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setSelectedEvent(event)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border2)", background: "transparent", color: "var(--muted)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                          Inspect
                        </button>
                        {event.status === "queued" && (
                          <button onClick={() => replayEvent(event.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,.3)", background: "rgba(34,197,94,.08)", color: "var(--green)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            Replay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backoff Chart */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginBottom: 16 }}>
          Standard Exponential Backoff vs. TrustSync AI Smart Schedule
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={BACKOFF_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gStd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c1c1c" vertical={false} />
              <XAxis dataKey="attempt" tick={{ fill: "#555", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "Delay (sec)", angle: -90, position: "insideLeft", fill: "#555", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #1c1c1c", borderRadius: 8, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }} />
              <Area type="monotone" dataKey="standard" stroke="#ef4444" strokeWidth={2.5} fill="url(#gStd)" name="Standard Backoff (Thundering Herd)" />
              <Area type="monotone" dataKey="ai" stroke="#22c55e" strokeWidth={2.5} fill="url(#gAI)" name="AI Optimized Schedule" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* JSON Drawer */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(4px)", zIndex: 200 }} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 250 }}
              style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 480, background: "var(--surface)", borderLeft: "1px solid var(--border)", zIndex: 201, display: "flex", flexDirection: "column", overflowY: "auto" }}>

              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--white)", marginBottom: 4 }}>Payload Inspector</div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--text2)" }}>{selectedEvent.id}</div>
                </div>
                <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer" }}>×</button>
              </div>

              <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Meta */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Gateway", value: selectedEvent.gateway, color: GW_COLOR[selectedEvent.gateway] },
                    { label: "Status", value: selectedEvent.status.toUpperCase(), color: STATUS_META[selectedEvent.status].color },
                    { label: "Anomaly Score", value: selectedEvent.anomalyScore.toFixed(3), color: selectedEvent.anomalyScore > 0.5 ? "var(--red)" : "var(--green)" },
                    { label: "Latency", value: `${selectedEvent.latencyMs}ms`, color: selectedEvent.latencyMs > 300 ? "var(--red)" : "var(--text)" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: m.color, fontSize: 13 }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* JSON */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8 }}>Raw Payload JSON</div>
                  <pre style={{ background: "#050505", border: "1px solid var(--border)", borderRadius: 10, padding: 16, fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "#22c55e", overflow: "auto", maxHeight: 300, lineHeight: 1.6 }}>
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>

              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)" }}>
                {selectedEvent.status === "queued" ? (
                  <button onClick={() => { replayEvent(selectedEvent.id); setSelectedEvent(null); }} className="btn btn-green" style={{ width: "100%", justifyContent: "center" }}>
                    ▶&nbsp; Trigger Immediate Retry Replay
                  </button>
                ) : (
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>No actions available for status: {selectedEvent.status}</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
