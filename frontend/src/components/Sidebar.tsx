"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCluster } from "@/context/ClusterContext";

const NAV = [
  { href: "/",             icon: "⬡", label: "Mission Control",   sub: "Live Telemetry" },
  { href: "/architecture", icon: "🗺", label: "System Architecture",sub: "Topology & Dynamic Flow" },
  { href: "/intelligence", icon: "◈", label: "AI Intelligence",   sub: "Models & Predictions" },
  { href: "/vault",        icon: "⊡", label: "Recovery Vault",    sub: "Queue & Replay" },
  { href: "/finops",       icon: "◎", label: "FinOps",            sub: "Cost Optimization" },
  { href: "/lab",          icon: "⊘", label: "Chaos Lab",         sub: "Fault Injection" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { faultMode, inferenceMode, tps } = useCluster();

  return (
    <aside style={{
      width: 240,
      height: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      left: 0,
      top: 0,
      zIndex: 100,
      overflowY: "auto",
    }}>

      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, boxShadow: "0 0 16px rgba(59,130,246,.4)",
          }}>⚡</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--white)", letterSpacing: "-0.02em" }}>TrustSync</div>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>.AI PLATFORM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", color: "var(--muted)", textTransform: "uppercase", padding: "10px 8px 6px" }}>Platform</div>
        {NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 9, marginBottom: 1,
                background: active ? "rgba(59,130,246,.1)" : "transparent",
                border: `1px solid ${active ? "rgba(59,130,246,.2)" : "transparent"}`,
                cursor: "pointer", transition: "all .15s", position: "relative",
              }}>
                {active && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: 3, height: "60%", borderRadius: "0 3px 3px 0", background: "var(--blue)",
                  }} />
                )}
                <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--white)" : "var(--text2)", lineHeight: 1.2 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{item.sub}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Cluster Status Footer */}
      <div style={{ padding: 10, borderTop: "1px solid var(--border)", marginTop: "auto", flexShrink: 0 }}>
        <div style={{
          background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 10, padding: "10px 12px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 7 }}>Cluster Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <StatusRow label="Inference" value={inferenceMode === "gpu" ? "Triton GPU" : "CPU Fallback"} color={inferenceMode === "gpu" ? "var(--green)" : "var(--blue)"} />
            <StatusRow label="Load" value={tps === 0 ? "IDLE" : `${tps.toLocaleString()} TPS`} color={tps === 0 ? "var(--muted)" : "var(--text)"} />
            <StatusRow label="Fault" value={faultMode === "none" ? "None" : faultMode.toUpperCase()} color={faultMode === "none" ? "var(--green)" : "var(--red)"} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
    </div>
  );
}
