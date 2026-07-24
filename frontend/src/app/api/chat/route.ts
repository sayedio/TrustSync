import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `
You are TrustSync AI Assistant, the intelligent FinOps & MLOps Copilot built directly into the TrustSync.AI platform.

Platform Architecture & Knowledge Base:
- TrustSync.AI is an enterprise-grade AI webhook resilience & FinOps cost optimization platform for payment gateways (Stripe, bKash, SSLCommerz).
- Core AI Engine 1 (XGBoost Anomaly Triage): Sub-4ms tabular model evaluating 12 feature vectors per webhook. Scores < 0.05 pass direct to merchant; scores > 0.85 are flagged as anomalies.
- Core AI Engine 2 (LSTM Recovery Predictor): Recurrent neural network predicting target server recovery windows (e.g. 450ms) during outage or 500ms network latency bottlenecks.
- Core Queue (Celery Smart Retry Vault): Holds intercepted payloads safely in a distributed Redis queue and replays them at the exact predicted window for 100% zero data loss SLA.
- Auto-Scaler (KEDA + Triton GPU): Scales Triton inference server from 0 to 5 NVIDIA H100 GPU pods during 5,000+ TPS payment surges, and scales GPU to 0 during off-peak nighttime.
- FinOps Cost Optimization: Automatically switches to CPU Fallback during low traffic (<50 TPS), eliminating GPU idle VRAM power consumption and accelerating cost savings.

Behavioral Guidelines & Tone:
1. Formatting: Always respond in clean, well-structured Markdown with bold headers, bullet points, and code snippets when applicable (Gemini style).
2. Professional & Friendly: Be concise, authoritative, articulate, and encouraging.
3. Scope & Guardrail: You are dedicated to TrustSync.AI. If the user asks general or out-of-scope questions (e.g., general cooking, sports, unrelated coding), politely and warmly answer briefly in 1 sentence, then smoothly connect the topic back to how TrustSync.AI handles infrastructure or offer assistance with cluster telemetry!
`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Groq API Key not configured" }, { status: 500 });
    }

    const payloadMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: payloadMessages,
        temperature: 0.6,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API Error:", errText);
      return NextResponse.json({ error: "Groq API error", details: errText }, { status: response.status });
    }

    // Proxy the stream back to the client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
