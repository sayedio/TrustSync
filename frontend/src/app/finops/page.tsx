"use client";
import { useCluster } from "@/context/ClusterContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { useState } from "react";

const KEDA_DATA = [
  { t: "09:00", tps: 20,  gpu: 0 },
  { t: "09:10", tps: 30,  gpu: 0 },
  { t: "09:20", tps: 48,  gpu: 0 },
  { t: "09:30", tps: 120, gpu: 1 },
  { t: "09:40", tps: 490, gpu: 3 },
  { t: "09:50", tps: 820, gpu: 5 },
  { t: "10:00", tps: 70,  gpu: 0 },
  { t: "10:10", tps: 35,  gpu: 0 },
];

function AnimatedNumber({ value, prefix = "", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  return (
    <motion.span
      key={Math.round(value * 10)}
      initial={{ opacity: 0.7, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ fontFamily: "JetBrains Mono, monospace" }}
    >
      {prefix}{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </motion.span>
  );
}

export default function FinOpsPage() {
  const { tps, savings, inferenceMode, setTps } = useCluster();
  const [threshold, setThreshold] = useState(500);

  const gpuLoad = inferenceMode === "gpu" ? Math.min(99, 38 + tps * 0.012) : 0;

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--white)", letterSpacing: "-0.03em", margin: 0, marginBottom: 4 }}>FinOps & Cost Intelligence</h1>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>Dynamic Triton GPU/CPU auto-scaling, idle power-down, and cluster cost optimization</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 10 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>Cost Optimization Active</span>
        </div>
      </div>

      {/* 3 ROI Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

        {/* Savings */}
        <div className="card glow-green" style={{ borderColor: "rgba(34,197,94,.25)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 10 }}>Total Cost Saved (YTD)</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "var(--green)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>
            <AnimatedNumber value={savings} prefix="$" decimals={2} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>GPU idle power-down savings</div>
        </div>

        {/* Inference Mode */}
        <div className={`card ${inferenceMode === "gpu" ? "glow-blue" : "glow-green"}`} style={{ borderColor: inferenceMode === "gpu" ? "rgba(59,130,246,.3)" : "rgba(34,197,94,.2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 10 }}>Active Inference Route</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: inferenceMode === "gpu" ? "var(--blue)" : "var(--green)", lineHeight: 1.2, marginBottom: 6 }}>
            {inferenceMode === "gpu" ? "🔵 TRITON GPU" : "🟢 CPU FALLBACK"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {inferenceMode === "gpu" ? "High-throughput peak mode (TPS > 500)" : "Zero GPU VRAM · Max cost savings"}
          </div>
        </div>

        {/* Bin-packing */}
        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 10 }}>Cluster Efficiency</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "var(--white)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>
            <span style={{ fontFamily: "JetBrains Mono, monospace" }}>94.8%</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Bin-packing ratio (KEDA optimal)</div>
        </div>
      </div>

      {/* Main section: Controls + Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

        {/* Live Engine Controls */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)" }}>KEDA Scaling Policy</div>

          {/* GPU Load bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>GPU Cluster Load</span>
              <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: inferenceMode === "gpu" ? "var(--green)" : "var(--muted)" }}>{Math.round(gpuLoad)}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border2)", borderRadius: 999, overflow: "hidden" }}>
              <motion.div animate={{ width: `${gpuLoad}%` }} transition={{ duration: 0.8 }}
                style={{ height: "100%", borderRadius: 999, background: inferenceMode === "gpu" ? "linear-gradient(90deg, #22c55e, #3b82f6)" : "var(--border2)" }} />
            </div>
          </div>

          {/* Status rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <StatusItem label="Inference Route" value={inferenceMode === "gpu" ? "Triton Server" : "CPU Fallback"} color={inferenceMode === "gpu" ? "var(--blue)" : "var(--green)"} />
            <StatusItem label="GPU Status" value={inferenceMode === "gpu" ? "ACTIVE" : "SUSPENDED (IDLE)"} color={inferenceMode === "gpu" ? "var(--green)" : "var(--muted)"} />
            <StatusItem label="Active GPU Nodes" value={inferenceMode === "gpu" ? "5" : "0"} color="var(--text)" />
          </div>

          {/* GPU Threshold Slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>GPU Threshold</span>
              <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "var(--blue)" }}>{threshold} TPS</span>
            </div>
            <input type="range" min={100} max={1000} value={threshold} onChange={e => setThreshold(+e.target.value)} />
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>GPU powers on above this TPS</div>
          </div>

          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginBottom: 4 }}>Policy</div>
            <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6 }}>
              When TPS drops below <strong style={{ color: "var(--blue)" }}>{threshold}</strong>, KEDA scales Triton to 0 pods and routes through XGBoost on CPU — saving ~$0.08/min in compute.
            </div>
          </div>
        </div>

        {/* KEDA Chart */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", marginBottom: 16 }}>
            KEDA Auto-Scaler: Traffic TPS vs. Active GPU Nodes
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={KEDA_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTpsK" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c1c1c" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0f0f0f", border: "1px solid #1c1c1c", borderRadius: 8, fontFamily: "JetBrains Mono, monospace", fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="tps" stroke="#3b82f6" strokeWidth={2} fill="url(#gTpsK)" name="Traffic (TPS)" />
                <Area yAxisId="r" type="stepAfter" dataKey="gpu" stroke="#22c55e" strokeWidth={2.5} fill="url(#gGpu)" name="GPU Nodes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 12, lineHeight: 1.6 }}>
            When the spike ends (10:00), GPU nodes scale to <strong style={{ color: "var(--green)" }}>0</strong> within 15s. XGBoost handles residual traffic on CPU — eliminating idle GPU cost entirely.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
