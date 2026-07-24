import type { Metadata } from "next";
import "./globals.css";
import { ClusterProvider } from "@/context/ClusterContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AIChatWidget from "@/components/AIChatWidget";

export const metadata: Metadata = {
  title: "TrustSync.AI — Intelligent Payment Resilience Platform",
  description: "AI-powered webhook failure prediction, smart recovery scheduling, and cluster FinOps for payment infrastructure.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
        <ClusterProvider>
          <Sidebar />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: "240px", minHeight: 0 }}>
            <Topbar />
            <main style={{ flex: 1, overflowY: "auto", padding: "0" }}>
              {children}
            </main>
          </div>
          <AIChatWidget />
        </ClusterProvider>
      </body>
    </html>
  );
}
