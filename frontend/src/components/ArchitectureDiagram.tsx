"use client";
import { useCluster, FaultMode } from "@/context/ClusterContext";

const MODES: Array<{ id: FaultMode; label: string; color: string; desc: string }> = [
  { id: "none",      label: "Normal",  color: "#22c55e", desc: "Direct delivery — all clear" },
  { id: "spike",     label: "Spike",   color: "#3b82f6", desc: "GPU scale-up — high throughput" },
  { id: "outage",    label: "Outage",  color: "#ef4444", desc: "Node failure — AI recovery active" },
  { id: "latency",   label: "Latency", color: "#f59e0b", desc: "Slow target — LSTM rescheduling" },
  { id: "nighttime", label: "Night",   color: "#8b5cf6", desc: "Idle mode — CPU fallback, GPU off" },
];

// Which SVG element IDs are on the "active" path for each mode
const ACTIVE: Record<FaultMode, Set<string>> = {
  none:      new Set(["n-gw","n-ai","n-triage","n-direct","n-merchant","e-gw-ai","e-ai-triage","e-triage-direct","e-direct-merchant"]),
  spike:     new Set(["n-gw","n-ai","n-triage","n-direct","n-merchant","e-gw-ai","e-ai-triage","e-triage-direct","e-direct-merchant","n-gpu"]),
  outage:    new Set(["n-gw","n-ai","n-triage","n-lstm","n-celery","n-merchant","e-gw-ai","e-ai-triage","e-triage-lstm","e-lstm-celery","e-celery-merchant"]),
  latency:   new Set(["n-gw","n-ai","n-triage","n-lstm","n-celery","n-merchant","e-gw-ai","e-ai-triage","e-triage-lstm","e-lstm-celery","e-celery-merchant"]),
  nighttime: new Set(["n-gw","n-ai","e-gw-ai"]),
};

const NODE_COLORS: Record<string, { fill: string; stroke: string }> = {
  "n-gw":       { fill: "#0f1829", stroke: "#3b82f6" },
  "n-ai":       { fill: "#0f1829", stroke: "#8b5cf6" },
  "n-triage":   { fill: "#0f1829", stroke: "#3b82f6" },
  "n-direct":   { fill: "#0a1f12", stroke: "#22c55e" },
  "n-merchant": { fill: "#0a1f12", stroke: "#22c55e" },
  "n-lstm":     { fill: "#1f1400", stroke: "#f59e0b" },
  "n-celery":   { fill: "#1f1400", stroke: "#f59e0b" },
  "n-gpu":      { fill: "#0f1829", stroke: "#3b82f6" },
};

const EDGE_COLORS: Record<string, string> = {
  "e-gw-ai":            "#8b5cf6",
  "e-ai-triage":        "#3b82f6",
  "e-triage-direct":    "#22c55e",
  "e-direct-merchant":  "#22c55e",
  "e-triage-lstm":      "#f59e0b",
  "e-lstm-celery":      "#f59e0b",
  "e-celery-merchant":  "#22c55e",
};

function op(id: string, mode: FaultMode): number {
  if (mode === "nighttime") return ACTIVE.nighttime.has(id) ? 0.9 : 0.12;
  return ACTIVE[mode].has(id) ? 1 : 0.12;
}

export default function ArchitectureDiagram() {
  const { faultMode, setFaultMode } = useCluster();
  const mode = faultMode;
  const modeColor = MODES.find(m => m.id === mode)?.color ?? "#3b82f6";
  const modeDesc = MODES.find(m => m.id === mode)?.desc ?? "";

  const nc = (id: string) => NODE_COLORS[id] ?? { fill: "#0f0f0f", stroke: "#2a2a2a" };
  const ns = (id: string) => op(id, mode) === 1 ? nc(id).stroke : "#2a2a2a";
  const nf = (id: string) => op(id, mode) === 1 ? nc(id).fill : "#0a0a0a";
  const es = (id: string) => op(id, mode) === 1 ? EDGE_COLORS[id] : "#1c1c1c";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* Mode Tabs */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setFaultMode(m.id)}
            title={m.desc}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: ".05em",
              cursor: "pointer",
              border: `1px solid ${mode === m.id ? m.color : "var(--border2)"}`,
              background: mode === m.id ? `${m.color}1a` : "transparent",
              color: mode === m.id ? m.color : "var(--muted)",
              transition: "all .15s",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Active mode description */}
      <div style={{ fontSize: 9, color: modeColor, fontFamily: "JetBrains Mono, monospace", fontWeight: 600, minHeight: 12 }}>
        → {modeDesc}
      </div>

      {/* SVG Diagram */}
      <svg viewBox="0 0 210 285" style={{ width: "100%", height: "auto" }}>
        <defs>
          <marker id="arrowG" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="#22c55e" />
          </marker>
          <marker id="arrowB" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="#8b5cf6" />
          </marker>
          <marker id="arrowBl" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="#3b82f6" />
          </marker>
          <marker id="arrowA" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* ─── Node: Payment Gateways ─── */}
        <g opacity={op("n-gw", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="5" y="6" width="200" height="28" rx="6" fill={nf("n-gw")} stroke={ns("n-gw")} strokeWidth="1.5" />
          <text x="105" y="16" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">Payment Gateways</text>
          <text x="105" y="26" textAnchor="middle" dominantBaseline="middle" fill="#666" fontSize="7" fontFamily="Inter,sans-serif">Stripe · bKash · SSLCommerz</text>
        </g>

        {/* Edge: GW → AI */}
        <g opacity={op("e-gw-ai", mode)} style={{ transition: "opacity .35s" }}>
          <line x1="105" y1="34" x2="105" y2="52" stroke={es("e-gw-ai")} strokeWidth="1.5" markerEnd="url(#arrowB)" />
        </g>

        {/* ─── Node: AI Ingress ─── */}
        <g opacity={op("n-ai", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="60" y="52" width="90" height="28" rx="6" fill={nf("n-ai")} stroke={ns("n-ai")} strokeWidth="1.5" />
          <text x="105" y="62" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">AI Ingress</text>
          <text x="105" y="72" textAnchor="middle" dominantBaseline="middle" fill={mode === "spike" ? "#3b82f6" : "#666"} fontSize="7" fontFamily="Inter,sans-serif">
            {mode === "spike" ? "Triton GPU Active" : "Gateway + Rate Limiter"}
          </text>
        </g>

        {/* Edge: AI → Triage */}
        <g opacity={op("e-ai-triage", mode)} style={{ transition: "opacity .35s" }}>
          <line x1="105" y1="80" x2="105" y2="98" stroke={es("e-ai-triage")} strokeWidth="1.5" markerEnd="url(#arrowBl)" />
        </g>

        {/* ─── Node: XGBoost Triage ─── */}
        <g opacity={op("n-triage", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="55" y="98" width="100" height="28" rx="6" fill={nf("n-triage")} stroke={ns("n-triage")} strokeWidth="1.5" />
          <text x="105" y="108" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">XGBoost Triage</text>
          <text x="105" y="118" textAnchor="middle" dominantBaseline="middle" fill="#666" fontSize="7" fontFamily="Inter,sans-serif">Anomaly Detect · 4ms</text>
        </g>

        {/* Edge: Triage → Direct (left branch) */}
        <g opacity={op("e-triage-direct", mode)} style={{ transition: "opacity .35s" }}>
          <path d="M 90 126 Q 65 146 48 158" stroke={es("e-triage-direct")} strokeWidth="1.5" fill="none" markerEnd="url(#arrowG)" />
          <text x="58" y="146" fill="#22c55e" fontSize="7" fontFamily="Inter,sans-serif">OK</text>
        </g>

        {/* Edge: Triage → LSTM (right branch) */}
        <g opacity={op("e-triage-lstm", mode)} style={{ transition: "opacity .35s" }}>
          <path d="M 120 126 Q 145 146 162 158" stroke={es("e-triage-lstm")} strokeWidth="1.5" fill="none" markerEnd="url(#arrowA)" />
          <text x="136" y="146" fill="#f59e0b" fontSize="7" fontFamily="Inter,sans-serif">⚠</text>
        </g>

        {/* ─── Node: Direct Pass (left) ─── */}
        <g opacity={op("n-direct", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="5" y="158" width="88" height="28" rx="6" fill={nf("n-direct")} stroke={ns("n-direct")} strokeWidth="1.5" />
          <text x="49" y="168" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">Direct Pass</text>
          <text x="49" y="178" textAnchor="middle" dominantBaseline="middle" fill="#22c55e" fontSize="7" fontFamily="Inter,sans-serif">14ms · 200 OK</text>
        </g>

        {/* ─── Node: LSTM (right) ─── */}
        <g opacity={op("n-lstm", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="117" y="158" width="88" height="28" rx="6" fill={nf("n-lstm")} stroke={ns("n-lstm")} strokeWidth="1.5" />
          <text x="161" y="168" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">LSTM Predictor</text>
          <text x="161" y="178" textAnchor="middle" dominantBaseline="middle" fill="#f59e0b" fontSize="7" fontFamily="Inter,sans-serif">Recovery window</text>
        </g>

        {/* Edge: Direct → Merchant */}
        <g opacity={op("e-direct-merchant", mode)} style={{ transition: "opacity .35s" }}>
          <line x1="49" y1="186" x2="49" y2="210" stroke={es("e-direct-merchant")} strokeWidth="1.5" markerEnd="url(#arrowG)" />
        </g>

        {/* Edge: LSTM → Celery */}
        <g opacity={op("e-lstm-celery", mode)} style={{ transition: "opacity .35s" }}>
          <line x1="161" y1="186" x2="161" y2="210" stroke={es("e-lstm-celery")} strokeWidth="1.5" markerEnd="url(#arrowA)" />
        </g>

        {/* ─── Node: Merchant API (left) ─── */}
        <g opacity={op("n-merchant", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="5" y="210" width="88" height="28" rx="6" fill={nf("n-merchant")} stroke={ns("n-merchant")} strokeWidth="1.5" />
          <text x="49" y="220" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">Merchant API</text>
          <text x="49" y="230" textAnchor="middle" dominantBaseline="middle" fill="#22c55e" fontSize="7" fontFamily="Inter,sans-serif">✓ Guaranteed</text>
        </g>

        {/* ─── Node: Celery Queue (right) ─── */}
        <g opacity={op("n-celery", mode)} style={{ transition: "opacity .35s" }}>
          <rect x="117" y="210" width="88" height="28" rx="6" fill={nf("n-celery")} stroke={ns("n-celery")} strokeWidth="1.5" />
          <text x="161" y="220" textAnchor="middle" dominantBaseline="middle" fill="#e8e8e8" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono,monospace">Celery Queue</text>
          <text x="161" y="230" textAnchor="middle" dominantBaseline="middle" fill="#f59e0b" fontSize="7" fontFamily="Inter,sans-serif">Smart retry →</text>
        </g>

        {/* Edge: Celery → Merchant (bottom arc) */}
        <g opacity={op("e-celery-merchant", mode)} style={{ transition: "opacity .35s" }}>
          <path d="M 117 224 L 93 224 L 93 238" stroke={es("e-celery-merchant")} strokeWidth="1.5" fill="none" markerEnd="url(#arrowG)" />
        </g>

        {/* GPU badge for spike mode */}
        {mode === "spike" && (
          <g opacity={1}>
            <rect x="148" y="56" width="56" height="16" rx="4" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1" />
            <text x="176" y="64" textAnchor="middle" dominantBaseline="middle" fill="#60a5fa" fontSize="7" fontWeight="700" fontFamily="JetBrains Mono,monospace">GPU×5 ACTIVE</text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
        <LegendDot color="#22c55e" label="Normal" />
        <LegendDot color="#f59e0b" label="Recovery" />
        <LegendDot color="#8b5cf6" label="AI Core" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 9, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}
