"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export type FaultMode = "none" | "spike" | "outage" | "latency" | "nighttime";
export type InferenceMode = "cpu" | "gpu";
export type WebhookStatus = "delivered" | "queued" | "recovered" | "failed";

export interface WebhookEvent {
  id: string;
  gateway: "Stripe" | "bKash" | "SSLCommerz";
  event: string;
  amount: number;
  currency: string;
  status: WebhookStatus;
  anomalyScore: number;
  latencyMs: number;
  retries: number;
  ts: Date;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  isDuplicate?: boolean;
}

export interface NodeMetric {
  id: number;
  name: string;
  role: string;
  type: string;
  cpuPct: number;
  memPct: number;
  tempC: number;
  powerW: number;
  status: "healthy" | "degraded" | "critical";
}

export type AiMode = "with" | "without";

// ─── Guard types ──────────────────────────────────────────────────────────────
export interface MatchEntry {
  id: string;
  gateway: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  deliveredAt: Date;
  confirmed: boolean; // true = unique delivery verified
  isDuplicate: boolean;
}

export interface BudgetEntry {
  gateway: string;
  count: number;
  limit: number;
  paused: boolean;
}

interface Cluster {
  tps: number;
  setTps: (v: number) => void;
  faultMode: FaultMode;
  setFaultMode: (v: FaultMode) => void;
  aiMode: AiMode;
  setAiMode: (v: AiMode) => void;
  inferenceMode: InferenceMode;
  totalWebhooks: number;
  recovered: number;
  savings: number;
  lastEvent: WebhookEvent | null;
  events: WebhookEvent[];
  nodes: NodeMetric[];
  sendWebhook: (gateway?: WebhookEvent["gateway"]) => void;
  replayEvent: (id: string) => void;
  clearLastEvent: () => void;
  markEventShown: (id: string) => void;
  dismissedIds: Set<string>;
  // Guard
  duplicatesBlocked: number;
  pausedMerchants: string[];
  matchingReport: MatchEntry[];
  retryBudgets: BudgetEntry[];
  triggerDuplicate: (gateway?: WebhookEvent["gateway"]) => void;
  triggerRetryStorm: (gateway?: WebhookEvent["gateway"]) => void;
  unblockMerchant: (gateway: string) => void;
}

const Ctx = createContext<Cluster | undefined>(undefined);

function makeEvent(faultMode: FaultMode, idx: number, gateway?: WebhookEvent["gateway"], aiMode: AiMode = "with"): WebhookEvent {
  const gateways: WebhookEvent["gateway"][] = ["Stripe", "bKash", "SSLCommerz"];
  const gw = gateway ?? gateways[idx % 3];
  const isAnomaly = faultMode !== "none";
  const events = ["payment_intent.succeeded", "checkout.session.completed", "charge.captured", "customer.subscription.updated", "payment_intent.failed"];
  const currencies: Record<string, string> = { Stripe: "USD", bKash: "BDT", SSLCommerz: "BDT" };
  const evtName = isAnomaly ? events[4] : events[idx % 4];

  let status: WebhookStatus = "delivered";
  let aiAction = "direct_delivery";
  let anomalyScore = Math.random() * 0.04;
  let latencyMs = Math.floor(Math.random() * 20 + 10);

  if (isAnomaly) {
    anomalyScore = 0.82 + Math.random() * 0.15;
    latencyMs = Math.floor(Math.random() * 900 + 300);

    if (aiMode === "without") {
      status = "failed";
      aiAction = "failed_unprotected_direct_call";
    } else {
      status = Math.random() > 0.5 ? "queued" : "recovered";
      aiAction = "intercepted_queued_for_retry";
    }
  }

  const amount = Math.floor(Math.random() * 800) + 20;
  const id = `wh_${Math.random().toString(36).slice(2, 9)}`;
  const idempotencyKey = `idem_${id}`;

  return {
    id,
    gateway: gw,
    event: evtName,
    amount,
    currency: currencies[gw],
    status,
    anomalyScore: parseFloat(anomalyScore.toFixed(3)),
    latencyMs,
    retries: isAnomaly && aiMode === "with" ? Math.floor(Math.random() * 3) + 1 : 0,
    ts: new Date(),
    idempotencyKey,
    isDuplicate: false,
    payload: {
      event: evtName,
      gateway: gw,
      amount,
      currency: currencies[gw],
      anomaly_detected: isAnomaly,
      ai_action: aiAction,
      ai_protection_active: aiMode === "with",
      xgboost_score: anomalyScore.toFixed(3),
      lstm_predicted_recovery_ms: isAnomaly && aiMode === "with" ? "450" : "n/a",
      idempotency_key: idempotencyKey,
    },
  };
}

const SEED_EVENTS: WebhookEvent[] = [
  { id: "wh_abc1234", gateway: "SSLCommerz", event: "payment_intent.succeeded", amount: 145, currency: "BDT", status: "recovered", anomalyScore: 0.941, latencyMs: 512, retries: 2, ts: new Date(Date.now() - 120000), idempotencyKey: "idem_abc1234", isDuplicate: false, payload: { event: "payment_intent.succeeded", ai_action: "smart_retry_recovered", lstm_predicted_recovery_ms: "450", idempotency_key: "idem_abc1234" } },
  { id: "wh_def5678", gateway: "bKash", event: "checkout.session.completed", amount: 85, currency: "BDT", status: "queued", anomalyScore: 0.876, latencyMs: 730, retries: 1, ts: new Date(Date.now() - 60000), idempotencyKey: "idem_def5678", isDuplicate: false, payload: { event: "checkout.session.completed", ai_action: "intercepted_queued_for_retry", idempotency_key: "idem_def5678" } },
  { id: "wh_ghi9012", gateway: "Stripe", event: "charge.captured", amount: 320, currency: "USD", status: "delivered", anomalyScore: 0.031, latencyMs: 14, retries: 0, ts: new Date(Date.now() - 30000), idempotencyKey: "idem_ghi9012", isDuplicate: false, payload: { event: "charge.captured", ai_action: "direct_delivery", idempotency_key: "idem_ghi9012" } },
  { id: "wh_jkl3456", gateway: "bKash", event: "customer.subscription.updated", amount: 25, currency: "BDT", status: "recovered", anomalyScore: 0.912, latencyMs: 390, retries: 1, ts: new Date(Date.now() - 240000), idempotencyKey: "idem_jkl3456", isDuplicate: false, payload: { event: "customer.subscription.updated", ai_action: "smart_retry_recovered", idempotency_key: "idem_jkl3456" } },
];

export function ClusterProvider({ children }: { children: React.ReactNode }) {
  const [tps, setTps] = useState(0);
  const [faultMode, setFaultMode] = useState<FaultMode>("none");
  const [aiMode, setAiMode] = useState<AiMode>("with");
  const [savings, setSavings] = useState(14523.48);
  const [totalWebhooks, setTotalWebhooks] = useState(128_441);
  const [recovered, setRecovered] = useState(4_218);
  const [events, setEvents] = useState<WebhookEvent[]>(SEED_EVENTS);
  const [lastEvent, setLastEvent] = useState<WebhookEvent | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const tickRef = useRef(0);

  // ─── Guard state ────────────────────────────────────────────────────────────
  const seenKeysRef = useRef<Set<string>>(new Set());
  const [duplicatesBlocked, setDuplicatesBlocked] = useState(0);
  const [pausedMerchants, setPausedMerchants] = useState<string[]>([]);
  const [matchingReport, setMatchingReport] = useState<MatchEntry[]>([
    { id: "wh_ghi9012", gateway: "Stripe", amount: 320, currency: "USD", idempotencyKey: "idem_ghi9012", deliveredAt: new Date(Date.now() - 30000), confirmed: true, isDuplicate: false },
    { id: "wh_abc1234", gateway: "SSLCommerz", amount: 145, currency: "BDT", idempotencyKey: "idem_abc1234", deliveredAt: new Date(Date.now() - 120000), confirmed: true, isDuplicate: false },
    { id: "wh_jkl3456", gateway: "bKash", amount: 25, currency: "BDT", idempotencyKey: "idem_jkl3456", deliveredAt: new Date(Date.now() - 240000), confirmed: true, isDuplicate: false },
  ]);
  const [retryBudgets, setRetryBudgets] = useState<BudgetEntry[]>([
    { gateway: "Stripe", count: 0, limit: 5, paused: false },
    { gateway: "bKash", count: 0, limit: 5, paused: false },
    { gateway: "SSLCommerz", count: 0, limit: 5, paused: false },
  ]);
  const retryCountsRef = useRef<Record<string, number>>({ Stripe: 0, bKash: 0, SSLCommerz: 0 });

  const inferenceMode: InferenceMode = tps > 500 ? "gpu" : "cpu";

  const nodes: NodeMetric[] = [
    { id: 1, name: "node-ingress-01", role: "API Gateway", type: "CPU ×4", cpuPct: Math.min(99, 28 + tps * 0.012), memPct: 41, tempC: 44, powerW: 120, status: "healthy" },
    { id: 2, name: "node-worker-01", role: "NVIDIA H100 Inference", type: "GPU 80GB", cpuPct: faultMode === "outage" ? 99 : Math.min(99, 42 + tps * 0.015), memPct: faultMode === "outage" ? 98 : Math.min(99, 52 + tps * 0.008), tempC: faultMode === "outage" ? 89 : 55, powerW: faultMode === "outage" ? 680 : (inferenceMode === "gpu" ? 310 : 45), status: faultMode === "outage" ? "critical" : "healthy" },
    { id: 3, name: "node-worker-02", role: "Celery Task Runner", type: "CPU ×8", cpuPct: faultMode === "outage" ? 92 : Math.min(80, 38 + tps * 0.01), memPct: 48, tempC: 50, powerW: 195, status: faultMode === "outage" ? "degraded" : "healthy" },
    { id: 4, name: "node-db-01", role: "PostgreSQL Primary", type: "CPU ×4 NVMe", cpuPct: Math.min(90, 60 + tps * 0.005), memPct: 68, tempC: 48, powerW: 190, status: "healthy" },
  ];

  const sendWebhook = useCallback((gateway: WebhookEvent["gateway"] = "Stripe") => {
    const ev = makeEvent(faultMode, tickRef.current, gateway, aiMode);
    const key = ev.idempotencyKey!;

    // ── Duplicate Guard ────────────────────────────────────────────────────
    if (seenKeysRef.current.has(key)) {
      // Duplicate detected — log it but don't increment counters
      const dupEv: WebhookEvent = { ...ev, id: `wh_dup_${Math.random().toString(36).slice(2,7)}`, isDuplicate: true, status: "failed" };
      setEvents(prev => [dupEv, ...prev.slice(0, 49)]);
      setDuplicatesBlocked(p => p + 1);
      return;
    }
    seenKeysRef.current.add(key);

    // ── Retry Budget ───────────────────────────────────────────────────────
    const isAnomaly = faultMode !== "none";
    if (isAnomaly) {
      const currentCount = retryCountsRef.current[gateway] ?? 0;
      const newCount = currentCount + 1;
      retryCountsRef.current[gateway] = newCount;
      const LIMIT = 5;
      const willPause = newCount >= LIMIT;

      setRetryBudgets(prev => prev.map(b =>
        b.gateway === gateway
          ? { ...b, count: newCount, paused: willPause }
          : b
      ));

      if (willPause && !pausedMerchants.includes(gateway)) {
        setPausedMerchants(prev => [...prev, gateway]);
      }
    }

    setEvents(prev => [ev, ...prev.slice(0, 49)]);
    setLastEvent(ev);
    setTotalWebhooks(p => p + 1);
    if (ev.status === "recovered" || ev.status === "queued") setRecovered(p => p + 1);

    // ── Add to matching report if delivered ───────────────────────────────
    if (ev.status === "delivered" || ev.status === "recovered") {
      const entry: MatchEntry = {
        id: ev.id, gateway: ev.gateway, amount: ev.amount, currency: ev.currency,
        idempotencyKey: key, deliveredAt: new Date(), confirmed: true, isDuplicate: false,
      };
      setMatchingReport(prev => [entry, ...prev.slice(0, 49)]);
    }
  }, [faultMode, aiMode, pausedMerchants]);

  // ─── Guard actions ─────────────────────────────────────────────────────────
  const triggerDuplicate = useCallback((gateway: WebhookEvent["gateway"] = "Stripe") => {
    // Send a real event first, then immediately resend its key
    const ev = makeEvent("none", tickRef.current++, gateway, aiMode);
    const key = ev.idempotencyKey!;
    seenKeysRef.current.add(key);

    // Original
    setEvents(prev => [ev, ...prev.slice(0, 49)]);
    setTotalWebhooks(p => p + 1);
    const entry: MatchEntry = {
      id: ev.id, gateway: ev.gateway, amount: ev.amount, currency: ev.currency,
      idempotencyKey: key, deliveredAt: new Date(), confirmed: true, isDuplicate: false,
    };
    setMatchingReport(prev => [entry, ...prev.slice(0, 49)]);

    // Duplicate — immediately after
    setTimeout(() => {
      const dupEv: WebhookEvent = {
        ...makeEvent("none", tickRef.current++, gateway, aiMode),
        id: `wh_dup_${Math.random().toString(36).slice(2,7)}`,
        idempotencyKey: key,
        isDuplicate: true,
        status: "failed",
      };
      setEvents(prev => [dupEv, ...prev.slice(0, 49)]);
      setDuplicatesBlocked(p => p + 1);
    }, 600);
  }, [aiMode]);

  const triggerRetryStorm = useCallback((gateway: WebhookEvent["gateway"] = "bKash") => {
    // Fire 6 anomaly events in quick succession to overflow the budget
    const LIMIT = 5;
    for (let i = 0; i < LIMIT + 1; i++) {
      setTimeout(() => {
        const ev = makeEvent("outage", tickRef.current++, gateway, "with");
        const key = ev.idempotencyKey!;
        seenKeysRef.current.add(key);

        const newCount = (retryCountsRef.current[gateway] ?? 0) + 1;
        retryCountsRef.current[gateway] = newCount;
        const willPause = newCount >= LIMIT;

        setRetryBudgets(prev => prev.map(b =>
          b.gateway === gateway ? { ...b, count: newCount, paused: willPause } : b
        ));

        if (willPause) {
          setPausedMerchants(prev => prev.includes(gateway) ? prev : [...prev, gateway]);
        }

        setEvents(prev => [ev, ...prev.slice(0, 49)]);
        setTotalWebhooks(p => p + 1);
        setRecovered(p => p + 1);
      }, i * 300);
    }
  }, []);

  const unblockMerchant = useCallback((gateway: string) => {
    setPausedMerchants(prev => prev.filter(m => m !== gateway));
    retryCountsRef.current[gateway] = 0;
    setRetryBudgets(prev => prev.map(b =>
      b.gateway === gateway ? { ...b, count: 0, paused: false } : b
    ));
  }, []);

  const replayEvent = useCallback((id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: "recovered", retries: e.retries + 1, latencyMs: Math.floor(Math.random() * 80 + 20) } : e));
  }, []);

  const clearLastEvent = useCallback(() => {
    setLastEvent(null);
  }, []);

  const markEventShown = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Main simulation loop — skipped entirely when tps === 0
  useEffect(() => {
    if (tps === 0) return;

    const interval = setInterval(() => {
      tickRef.current++;
      // Smooth, realistic counter increment scaled visually
      const inc = Math.max(1, Math.ceil(tps * 0.004));
      setTotalWebhooks(p => p + inc);

      if (faultMode !== "none") {
        if (aiMode === "with") {
          setRecovered(p => p + Math.max(1, Math.ceil(inc * 0.85)));
        }
        if (Math.random() > 0.6) {
          const ev = makeEvent(faultMode, tickRef.current, undefined, aiMode);
          setEvents(prev => [ev, ...prev.slice(0, 49)]);
        }
      } else {
        if (Math.random() > 0.75) {
          const ev = makeEvent("none", tickRef.current, undefined, aiMode);
          setEvents(prev => [ev, ...prev.slice(0, 49)]);
        }
      }
      // Savings tick (CPU fallback = GPU idle = cost saved) - realistic small increment
      if (inferenceMode === "cpu") {
        setSavings(p => p + (Math.random() * 0.0015 + 0.0005));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [tps, faultMode, aiMode, inferenceMode]);

  return (
    <Ctx.Provider value={{
      tps, setTps, faultMode, setFaultMode, aiMode, setAiMode, inferenceMode,
      totalWebhooks, recovered, savings, lastEvent, events, nodes,
      sendWebhook, replayEvent, clearLastEvent, markEventShown, dismissedIds,
      duplicatesBlocked, pausedMerchants, matchingReport, retryBudgets,
      triggerDuplicate, triggerRetryStorm, unblockMerchant,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCluster() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCluster must be inside ClusterProvider");
  return ctx;
}
