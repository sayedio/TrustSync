"use client";
import { useState } from "react";
import { useCluster } from "@/context/ClusterContext";

export default function Topbar() {
  const { faultMode, sendWebhook } = useCluster();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpoint = "https://gateway.trustsync.ai/v1/ingest";

  const handleCopy = () => {
    navigator.clipboard.writeText(endpoint).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    setSending(true);
    sendWebhook();
    setTimeout(() => setSending(false), 700);
  };

  const degraded = faultMode !== "none";

  return (
    <header style={{
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0,
      zIndex: 90,
    }}>

      {/* Left: Endpoint pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg)",
          border: "1px solid var(--border2)",
          borderRadius: 8,
          padding: "5px 10px",
          cursor: "pointer",
        }} onClick={handleCopy}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", fontFamily: "JetBrains Mono, monospace" }}>POST</span>
          <span style={{ fontSize: 12, fontFamily: "JetBrains Mono, monospace", color: "var(--text2)" }}>{endpoint}</span>
          <span style={{ fontSize: 12, color: copied ? "var(--green)" : "var(--muted)" }}>{copied ? "✓" : "⎘"}</span>
        </div>

        <button className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ fontSize: 12, padding: "6px 14px" }}>
          {sending ? "Triggering..." : "▶  Send Test Webhook"}
        </button>
      </div>

      {/* Right: status indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* System health */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px",
          borderRadius: 8,
          border: `1px solid ${degraded ? "rgba(239,68,68,.25)" : "rgba(34,197,94,.2)"}`,
          background: degraded ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.06)",
          fontSize: 11,
          fontWeight: 600,
          color: degraded ? "var(--red)" : "var(--green)",
        }}>
          <span className={`pulse-dot ${degraded ? "red" : "green"}`} />
          {degraded ? `FAULT: ${faultMode.toUpperCase()}` : "ALL SYSTEMS OPERATIONAL"}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "var(--border2)" }} />

        {/* User chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "white",
          }}>TS</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>Prod Cluster</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Enterprise</div>
          </div>
        </div>
      </div>
    </header>
  );
}
