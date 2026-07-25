"use client";
import { useState } from "react";
import { useCluster } from "@/context/ClusterContext";
import { motion, AnimatePresence } from "framer-motion";

const GW_COLOR: Record<string, string> = {
  Stripe: "#635BFF",
  bKash: "#E91E8C",
  SSLCommerz: "#F59E0B",
};

function BudgetBar({ gateway, count, limit, paused }: { gateway: string; count: number; limit: number; paused: boolean }) {
  const pct = Math.min((count / limit) * 100, 100);
  const color = paused ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: GW_COLOR[gateway] ?? "var(--text)" }}>{gateway}</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: paused ? "#ef4444" : "var(--text2)" }}>
          {count}/{limit} {paused ? "— PAUSED" : ""}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--border2)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          style={{ height: "100%", borderRadius: 99, background: color, boxShadow: paused ? `0 0 8px ${color}88` : "none" }}
        />
      </div>
    </div>
  );
}

export default function GuardPage() {
  const {
    duplicatesBlocked,
    pausedMerchants,
    matchingReport,
    retryBudgets,
    triggerDuplicate,
    triggerRetryStorm,
    unblockMerchant,
    events,
  } = useCluster();

  const [activeTab, setActiveTab] = useState<"report" | "paused" | "budgets">("report");
  const [unblockAnim, setUnblockAnim] = useState<string | null>(null);

  const duplicateEvents = events.filter(e => e.isDuplicate);

  const handleUnblock = (gw: string) => {
    setUnblockAnim(gw);
    setTimeout(() => { unblockMerchant(gw); setUnblockAnim(null); }, 600);
  };

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #ef4444, #f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 16px rgba(239,68,68,.4)" }}>🛡</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0 }}>Duplicate Guard & Retry Budget</h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>
          Idempotency enforcement, per-merchant retry quotas, and exact-once delivery proof
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          { label: "Duplicates Blocked", value: duplicatesBlocked, color: "#ef4444", icon: "🚫" },
          { label: "Merchants Paused", value: pausedMerchants.length, color: "#f59e0b", icon: "⏸" },
          { label: "Confirmed Deliveries", value: matchingReport.filter(r => r.confirmed && !r.isDuplicate).length, color: "#22c55e", icon: "✓" },
          { label: "Unique Keys Issued", value: matchingReport.length, color: "#3b82f6", icon: "🔑" },
        ].map(s => (
          <div key={s.label} className="card" style={{ borderColor: `${s.color}22`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)" }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: "JetBrains Mono, monospace" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Demo buttons */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>🧪 Live Demo Controls</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            id="btn-send-duplicate"
            onClick={() => triggerDuplicate("Stripe")}
            style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.08)", color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            🚫 Send Duplicate Payment (Stripe)
          </button>
          <button
            id="btn-retry-storm"
            onClick={() => triggerRetryStorm("bKash")}
            style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(245,158,11,.4)", background: "rgba(245,158,11,.08)", color: "#f59e0b", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            ⚡ Trigger Retry Storm (bKash)
          </button>
          <button
            id="btn-retry-storm-ssl"
            onClick={() => triggerRetryStorm("SSLCommerz")}
            style={{ padding: "10px 20px", borderRadius: 9, border: "1px solid rgba(99,91,255,.4)", background: "rgba(99,91,255,.08)", color: "#635BFF", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            ⚡ Trigger Retry Storm (SSLCommerz)
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          "Send Duplicate Payment" fires 2 webhooks with the same idempotency key — the second is instantly blocked. "Trigger Retry Storm" fires 6 failing webhooks in quick succession to exceed the budget and auto-pause the merchant.
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Tab header */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["report", "paused", "budgets"] as const).map(tab => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === tab ? "var(--blue)" : "transparent"}`,
                color: activeTab === tab ? "var(--white)" : "var(--muted)",
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em",
                transition: "all .15s",
              }}
            >
              {tab === "report" && `📋 Matching Report (${matchingReport.length})`}
              {tab === "paused" && `⏸ Paused Merchants (${pausedMerchants.length})`}
              {tab === "budgets" && "📊 Retry Budgets"}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          <AnimatePresence mode="wait">

            {/* ── Matching Report ── */}
            {activeTab === "report" && (
              <motion.div key="report" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 16 }}>
                  Every payment listed below was delivered <strong style={{ color: "var(--green)" }}>exactly once</strong>. Idempotency keys ensure no shop is charged twice.
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Idempotency Key</th>
                        <th>Gateway</th>
                        <th>Amount</th>
                        <th>Delivered At</th>
                        <th>Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingReport.slice(0, 20).map((entry, i) => (
                        <tr key={`${entry.idempotencyKey}-${i}`}>
                          <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text2)" }}>{entry.idempotencyKey}</span></td>
                          <td><span style={{ fontWeight: 700, color: GW_COLOR[entry.gateway] ?? "var(--text)", fontSize: 12 }}>{entry.gateway}</span></td>
                          <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>{entry.currency} {entry.amount}</span></td>
                          <td><span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text2)" }}>{entry.deliveredAt.toLocaleTimeString()}</span></td>
                          <td>
                            <span className="badge" style={{
                              background: entry.isDuplicate ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)",
                              color: entry.isDuplicate ? "#ef4444" : "#22c55e",
                              border: `1px solid ${entry.isDuplicate ? "#ef444433" : "#22c55e33"}`,
                            }}>
                              {entry.isDuplicate ? "⚠ DUPLICATE BLOCKED" : "✓ VERIFIED UNIQUE"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {matchingReport.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32, fontSize: 13 }}>No deliveries yet — send a webhook to populate the report.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Duplicate events log */}
                {duplicateEvents.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "#ef4444", marginBottom: 12 }}>
                      🚫 Blocked Duplicate Attempts ({duplicateEvents.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {duplicateEvents.slice(0, 5).map(ev => (
                        <div key={ev.id} style={{ background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#ef4444" }}>{ev.id}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 10 }}>Key: <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{ev.idempotencyKey}</span></span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,.12)", padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,.3)" }}>BLOCKED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Paused Merchants ── */}
            {activeTab === "paused" && (
              <motion.div key="paused" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {pausedMerchants.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)", fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>No merchants paused</div>
                    <div>All gateways are within their retry budgets. Use "Trigger Retry Storm" to demo auto-pause.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                      These merchants have exceeded their retry budget and are paused for review. No new webhooks will be accepted until unblocked.
                    </div>
                    {pausedMerchants.map(gw => {
                      const budget = retryBudgets.find(b => b.gateway === gw);
                      return (
                        <motion.div
                          key={gw}
                          id={`paused-merchant-${gw.toLowerCase()}`}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: unblockAnim === gw ? 0 : 1, scale: unblockAnim === gw ? 0.95 : 1 }}
                          style={{
                            background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.25)",
                            borderRadius: 12, padding: "16px 20px", display: "flex",
                            justifyContent: "space-between", alignItems: "center", gap: 12,
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
                              <span style={{ fontWeight: 700, color: GW_COLOR[gw] ?? "var(--text)", fontSize: 14 }}>{gw}</span>
                              <span className="badge" style={{ background: "rgba(239,68,68,.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,.3)", fontSize: 9 }}>PAUSED FOR REVIEW</span>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text2)" }}>
                              Retry budget exceeded: <strong style={{ fontFamily: "JetBrains Mono, monospace", color: "#ef4444" }}>{budget?.count ?? "?"}/{budget?.limit ?? 5}</strong> retries in the current window
                            </div>
                          </div>
                          <button
                            id={`btn-unblock-${gw.toLowerCase()}`}
                            onClick={() => handleUnblock(gw)}
                            style={{
                              padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(34,197,94,.4)",
                              background: "rgba(34,197,94,.08)", color: "#22c55e", fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            ✓ Unblock & Reset Budget
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Retry Budgets ── */}
            {activeTab === "budgets" && (
              <motion.div key="budgets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 20 }}>
                  Each merchant/gateway is limited to <strong style={{ color: "var(--white)" }}>5 failing retries per 60-second window</strong>. Exceeding this limit triggers an automatic pause and flags the merchant for review.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {retryBudgets.map(b => (
                    <div key={b.gateway} style={{
                      background: b.paused ? "rgba(239,68,68,.04)" : "var(--bg)",
                      border: `1px solid ${b.paused ? "rgba(239,68,68,.2)" : "var(--border)"}`,
                      borderRadius: 12, padding: "16px 20px",
                    }}>
                      <BudgetBar gateway={b.gateway} count={b.count} limit={b.limit} paused={b.paused} />
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                        {b.paused
                          ? <span style={{ color: "#ef4444", fontWeight: 600 }}>⏸ Merchant paused — switch to Paused Merchants tab to unblock</span>
                          : b.count === 0
                            ? "No retries this window — healthy baseline."
                            : `${b.limit - b.count} retry slot${b.limit - b.count === 1 ? "" : "s"} remaining before auto-pause`
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{ marginTop: 20, display: "flex", gap: 20, fontSize: 11, color: "var(--muted)" }}>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#22c55e", marginRight: 5 }} />Healthy (0–79%)</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#f59e0b", marginRight: 5 }} />Warning (80–99%)</span>
                  <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ef4444", marginRight: 5 }} />Paused (100%+)</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Architecture note */}
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>🏗</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--white)", marginBottom: 6 }}>How Duplicate Guard Works</div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.7 }}>
            Every payment is assigned a unique <strong style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--blue)" }}>idempotency_key</strong> (UUID) before entering the system. 
            The key is checked against a Redis/PostgreSQL ledger before any delivery attempt. 
            If the key already exists, the webhook is instantly rejected with <strong style={{ fontFamily: "JetBrains Mono, monospace", color: "#ef4444" }}>status: duplicate_blocked</strong> — 
            ensuring the shop is never charged or shipped twice, even during retry storms.
            The <strong style={{ color: "var(--amber)" }}>Retry Budget</strong> layer sits above this — tracking per-merchant retry counts within a sliding time window and automatically pausing merchants that show pathological failure patterns, preventing cascade overload.
          </div>
        </div>
      </div>

    </div>
  );
}
