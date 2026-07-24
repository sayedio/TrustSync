"use client";
import { useState, useEffect, useCallback } from "react";
import { useCluster, FaultMode } from "@/context/ClusterContext";
import { motion } from "framer-motion";

// ─── SVG layout (viewBox 860 × 200) ───────────────────────────────────────
const N = {
  src:      { x: 70,  y: 100, r: 30 },
  ai:       { x: 230, y: 100, r: 24 },
  triage:   { x: 400, y: 100, r: 24 },
  direct:   { x: 575, y: 55,  r: 20 },
  lstm:     { x: 575, y: 145, r: 20 },
  celery:   { x: 700, y: 145, r: 20 },
  merchant: { x: 800, y: 100, r: 28 },
};

const GW_COLORS: Record<string, string> = {
  Stripe:     "#635BFF",
  bKash:      "#E91E8C",
  SSLCommerz: "#F59E0B",
};

type GW = "Stripe" | "bKash" | "SSLCommerz";
const GW_LIST: GW[] = ["Stripe", "bKash", "SSLCommerz"];

// Flow Paths
const NORMAL_PATH    = [N.src, N.ai, N.triage, N.direct, N.merchant];
const NORMAL_TIMES   = [0, 0.25, 0.5, 0.75, 1];

const RECOVERY_PATH  = [N.src, N.ai, N.triage, N.lstm, N.celery, N.merchant];
const RECOVERY_TIMES = [0, 0.2, 0.4, 0.6, 0.8, 1];

const OFFPEAK_PATH   = [N.src, N.ai, N.direct, N.merchant];
const OFFPEAK_TIMES  = [0, 0.33, 0.66, 1];

const DIRECT_PATH    = [N.src, N.merchant];
const DIRECT_TIMES   = [0, 1];

interface Pkt {
  id: string;
  color: string;
  gwLabel: string;
  pathX: number[];
  pathY: number[];
  times: number[];
  isAnomaly: boolean;
}

let uid = 0;

function makePkt(faultMode: FaultMode, tab: string): Pkt {
  const gw = GW_LIST[Math.floor(Math.random() * 3)];
  const isNight = faultMode === "nighttime";
  const isAnomaly = tab === "with" && (faultMode === "outage" || faultMode === "latency");

  let path = NORMAL_PATH;
  let times = NORMAL_TIMES;

  if (isNight) {
    path = OFFPEAK_PATH;
    times = OFFPEAK_TIMES;
  } else if (isAnomaly) {
    path = RECOVERY_PATH;
    times = RECOVERY_TIMES;
  }

  return {
    id: `p${++uid}`,
    color: GW_COLORS[gw],
    gwLabel: gw,
    pathX: path.map(p => p.x),
    pathY: path.map(p => p.y),
    times,
    isAnomaly,
  };
}

function makeDirectPkt(faultMode: FaultMode): Pkt {
  const gw = GW_LIST[Math.floor(Math.random() * 3)];
  return {
    id: `p${++uid}`,
    color: faultMode !== "none" ? "#ef4444" : GW_COLORS[gw],
    gwLabel: gw,
    pathX: DIRECT_PATH.map(p => p.x),
    pathY: DIRECT_PATH.map(p => p.y),
    times: DIRECT_TIMES,
    isAnomaly: faultMode !== "none",
  };
}

export default function SimulationFlow() {
  const { tps, faultMode, aiMode, setAiMode } = useCluster();
  const tab = aiMode;
  const setTab = (mode: "with" | "without") => setAiMode(mode);

  const [packets, setPackets] = useState<Pkt[]>([]);
  const removePkt = useCallback((id: string) => setPackets(p => p.filter(x => x.id !== id)), []);

  // CRITICAL FIX: Clear old packets whenever tab or faultMode changes so dots NEVER float on old paths!
  useEffect(() => {
    setPackets([]);
  }, [tab, faultMode]);

  // Spawn packets based on TPS
  useEffect(() => {
    if (tps === 0) { setPackets([]); return; }
    const rate = Math.max(0.3, Math.min(6, tps / 200));
    const ms   = 1000 / rate;

    const id = setInterval(() => {
      setPackets(prev => {
        if (prev.length >= 16) return prev;
        const pkt = tab === "with" ? makePkt(faultMode, tab) : makeDirectPkt(faultMode);
        return [...prev, pkt];
      });
    }, ms);
    return () => clearInterval(id);
  }, [tps, faultMode, tab]);

  const isFaultActive = faultMode !== "none";
  const degraded = faultMode === "outage" || faultMode === "latency";
  const isNight = faultMode === "nighttime";
  const isSpike = faultMode === "spike";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Section header + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.01em" }}>Live Webhook Flow Simulator</div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>Watch requests route through the system in real-time</div>
        </div>
        <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 8, overflow: "hidden" }}>
          {(["with", "without"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 14px", border: "none", cursor: "pointer",
              background: tab === t ? (t === "with" ? "var(--blue)" : "rgba(239,68,68,.15)") : "transparent",
              color: tab === t ? (t === "with" ? "white" : "var(--red)") : "var(--muted)",
              fontSize: 11, fontWeight: 700,
              borderRight: t === "with" ? "1px solid var(--border2)" : "none",
              transition: "all .15s",
            }}>
              {t === "with" ? "✦ With TrustSync AI" : "✗ Without AI Model"}
            </button>
          ))}
        </div>
      </div>

      {/* Idle state when TPS=0 */}
      {tps === 0 && (
        <div style={{
          height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, gap: 8,
        }}>
          <div style={{ fontSize: 28, opacity: .3 }}>⏸</div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "JetBrains Mono, monospace" }}>Traffic paused — set TPS &gt; 0 to start simulation</div>
        </div>
      )}

      {/* SVG Canvas */}
      {tps > 0 && (
        <div style={{ position: "relative", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <svg viewBox="0 0 860 200" style={{ width: "100%", display: "block" }}>
            {/* ── Edges for WITH AI ── */}
            {tab === "with" && (
              <>
                {/* Gateways → AI Ingress */}
                <line x1={N.src.x} y1={N.src.y} x2={N.ai.x} y2={N.ai.y} stroke="#3b82f6" strokeWidth="2" />

                {!isNight ? (
                  <>
                    {/* AI → XGBoost */}
                    <line x1={N.ai.x} y1={N.ai.y} x2={N.triage.x} y2={N.triage.y} stroke="#8b5cf6" strokeWidth="2" />

                    {/* Direct Pass branch: triage → direct → merchant */}
                    <line x1={N.triage.x} y1={N.triage.y} x2={N.direct.x} y2={N.direct.y} stroke={degraded ? "#1c1c1c" : "#22c55e44"} strokeWidth="2" strokeDasharray={degraded ? "4 4" : "0"} />
                    <line x1={N.direct.x} y1={N.direct.y} x2={N.merchant.x} y2={N.merchant.y} stroke={degraded ? "#1c1c1c" : "#22c55e"} strokeWidth="2" />

                    {/* Recovery branch: triage → lstm → celery → merchant */}
                    <line x1={N.triage.x} y1={N.triage.y} x2={N.lstm.x} y2={N.lstm.y} stroke={degraded ? "#f59e0b" : "#1c1c1c"} strokeWidth="2" strokeDasharray={degraded ? "0" : "4 4"} />
                    <line x1={N.lstm.x} y1={N.lstm.y} x2={N.celery.x} y2={N.celery.y} stroke={degraded ? "#f59e0b" : "#1c1c1c"} strokeWidth="2" />
                    <path d={`M ${N.celery.x} ${N.celery.y} Q 760 ${N.celery.y} ${N.merchant.x} ${N.merchant.y}`} stroke={degraded ? "#22c55e" : "#1c1c1c"} strokeWidth="2" fill="none" />
                  </>
                ) : (
                  /* Off-Peak Nighttime Flow: Directly from AI Ingress (CPU) → Direct Pass → Merchant */
                  <>
                    <line x1={N.ai.x} y1={N.ai.y} x2={N.direct.x} y2={N.direct.y} stroke="#22c55e" strokeWidth="2" />
                    <line x1={N.direct.x} y1={N.direct.y} x2={N.merchant.x} y2={N.merchant.y} stroke="#22c55e" strokeWidth="2" />
                  </>
                )}
              </>
            )}

            {/* ── Edges for WITHOUT AI ── */}
            {tab === "without" && (
              <line x1={N.src.x} y1={N.src.y} x2={N.merchant.x} y2={N.merchant.y} stroke={isFaultActive ? "#ef4444" : "#22c55e"} strokeWidth="2" strokeDasharray={isFaultActive ? "6 4" : "0"} />
            )}

            {/* ── Animated Packets ── */}
            {packets.map(pkt => (
              <AnimatedPacket key={pkt.id} pkt={pkt} onDone={removePkt} />
            ))}

            {/* ── Nodes for WITH AI ── */}
            {tab === "with" && (
              <>
                <FlowNode cx={N.src.x} cy={N.src.y} r={N.src.r} title="Payment Gateways" sub="Stripe·bKash·SSL" color="#3b82f6" active />
                <FlowNode cx={N.ai.x} cy={N.ai.y} r={N.ai.r} title="AI Ingress" sub={isNight ? "CPU Fallback" : isSpike ? "Triton GPU×5" : "TrustSync Core"} color={isNight ? "#22c55e" : "#8b5cf6"} active />

                {!isNight ? (
                  <>
                    <FlowNode cx={N.triage.x} cy={N.triage.y} r={N.triage.r} title="XGBoost" sub="Triage 4ms" color="#3b82f6" active />
                    <FlowNode cx={N.direct.x} cy={N.direct.y} r={N.direct.r} title="Direct Pass" sub="14ms · OK" color="#22c55e" active={!degraded} dim={degraded} />
                    <FlowNode cx={N.lstm.x} cy={N.lstm.y} r={N.lstm.r} title="LSTM" sub="Predictor" color="#f59e0b" active={degraded} dim={!degraded} />
                    <FlowNode cx={N.celery.x} cy={N.celery.y} r={N.celery.r} title="Celery Queue" sub="Smart Retry" color="#f59e0b" active={degraded} dim={!degraded} />
                  </>
                ) : (
                  <FlowNode cx={N.direct.x} cy={N.direct.y} r={N.direct.r} title="Direct Pass" sub="CPU Light" color="#22c55e" active />
                )}

                <FlowNode cx={N.merchant.x} cy={N.merchant.y} r={N.merchant.r} title="Merchant API" sub="100% Guaranteed" color="#22c55e" active />
              </>
            )}

            {/* ── Nodes for WITHOUT AI ── */}
            {tab === "without" && (
              <>
                <FlowNode cx={N.src.x} cy={N.src.y} r={N.src.r} title="Payment Gateways" sub="Incoming Traffic" color="#3b82f6" active />
                <FlowNode cx={N.merchant.x} cy={N.merchant.y} r={N.merchant.r} title="Merchant API" sub={isFaultActive ? "500 FAILED ✗" : "Direct API ✓"} color={isFaultActive ? "#ef4444" : "#22c55e"} active glowRed={isFaultActive} />
                {isFaultActive && (
                  <g>
                    <text x={N.merchant.x} y={N.merchant.y - 44} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="800" fontFamily="JetBrains Mono, monospace">500 ERROR ✗</text>
                    <text x={N.merchant.x} y={N.merchant.y - 30} textAnchor="middle" fill="#ef4444" fontSize="9" fontFamily="Inter, sans-serif">Recovery Not Possible</text>
                  </g>
                )}
              </>
            )}
          </svg>

          {/* Node Legend Labels */}
          <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 24px 10px", borderTop: "1px solid var(--border)" }}>
            {tab === "with" ? (
              isNight ? [
                { label: "Gateways", desc: "Incoming traffic" },
                { label: "AI Ingress", desc: "CPU Fallback (GPU 0)" },
                { label: "Direct Pass", desc: "Zero VRAM consumed" },
                { label: "Merchant API", desc: "100% Delivery" },
              ] : [
                { label: "Gateways", desc: "Stripe · bKash · SSL" },
                { label: "AI Ingress", desc: "Rate limit & Hash" },
                { label: "XGBoost", desc: "Anomaly Score" },
                { label: degraded ? "LSTM Predictor" : "Direct Pass", desc: degraded ? "Recovery window" : "14ms Fast-path" },
                { label: degraded ? "Celery Queue" : "Merchant API", desc: degraded ? "Smart retry vault" : "100% Guaranteed" },
              ]
            ).map((item, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text2)", fontFamily: "JetBrains Mono, monospace" }}>{item.label}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>{item.desc}</div>
              </div>
            )) : [
              { label: "Gateways", desc: "Incoming traffic" },
              { label: "Merchant API Target", desc: degraded ? "❌ 500 Outage Failure" : "Direct Unprotected Call" },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text2)", fontFamily: "JetBrains Mono, monospace" }}>{item.label}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Callout Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        {/* WITH AI CARD */}
        <div style={{ background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>✦ With TrustSync AI Model</div>
          <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6 }}>
            {degraded ? (
              <span>XGBoost flags outage → LSTM calculates 450ms recovery window → Celery queues payload → <strong style={{ color: "var(--green)" }}>100% Recovered Progress</strong></span>
            ) : isNight ? (
              <span>KEDA scales GPU to 0 → XGBoost runs on CPU → <strong style={{ color: "var(--green)" }}>Max Cost Savings & Full SLA</strong></span>
            ) : (
              <span>XGBoost triage &lt;0.05 → Fast direct pass → <strong style={{ color: "var(--green)" }}>14ms Guaranteed Delivery</strong></span>
            )}
          </div>
        </div>

        {/* WITHOUT AI CARD */}
        <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>✗ Without AI Model Protection</div>
          <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6 }}>
            {degraded ? (
              <span>Direct calls hit broken merchant → <strong style={{ color: "var(--red)" }}>RECOVERY FAILED: Webhooks lost forever with 500 error</strong></span>
            ) : (
              <span>No anomaly detection → No adaptive retry window → <strong style={{ color: "var(--red)" }}>Vulnerable to outages & thundering herds</strong></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Animated Packet ─────────────────────────────────────────────────────────
function AnimatedPacket({ pkt, onDone }: { pkt: Pkt; onDone: (id: string) => void }) {
  return (
    <motion.g>
      <motion.circle
        r={5}
        fill={pkt.color}
        style={{ filter: `drop-shadow(0 0 4px ${pkt.color})` }}
        initial={{ cx: pkt.pathX[0], cy: pkt.pathY[0], opacity: 0 }}
        animate={{
          cx: pkt.pathX,
          cy: pkt.pathY,
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: 2.5,
          times: pkt.times,
          ease: "easeInOut",
        }}
        onAnimationComplete={() => onDone(pkt.id)}
      />
    </motion.g>
  );
}

// ── SVG Node Circle with NO TEXT OVERLAP ─────────────────────────────────────
function FlowNode({ cx, cy, r, title, sub, color, active, dim, glowRed }: {
  cx: number; cy: number; r: number; title: string; sub: string; color: string;
  active?: boolean; dim?: boolean; glowRed?: boolean;
}) {
  const opacity = dim ? 0.25 : 1;
  return (
    <g opacity={opacity} style={{ transition: "opacity .3s" }}>
      {glowRed && <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />}
      <circle cx={cx} cy={cy} r={r} fill="#0f0f0f" stroke={active ? color : "#2a2a2a"} strokeWidth="1.5" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={active ? "#ffffff" : "#666666"} fontSize={r > 24 ? 9 : 8} fontWeight="800" fontFamily="JetBrains Mono, monospace">
        {title}
      </text>
      <text x={cx} y={cy + r + 11} textAnchor="middle" dominantBaseline="central" fill={active ? color : "#444444"} fontSize="7.5" fontFamily="Inter, sans-serif">
        {sub}
      </text>
    </g>
  );
}
