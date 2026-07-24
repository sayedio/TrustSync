"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "How does XGBoost Anomaly Triage work?",
  "Explain the LSTM Recovery Window",
  "How does KEDA GPU auto-scaling save costs?",
  "What happens during a DB Outage?",
];

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I am **TrustSync AI Copilot**, powered by **Groq LLaMA-3.3 70B**.\n\nAsk me anything about our **XGBoost anomaly triage**, **LSTM recovery predictor**, **Celery vault**, or **FinOps GPU cost optimization**!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!queryText) setInput("");
    setIsLoading(true);

    // Placeholder for streaming assistant response
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to Groq AI");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.substring(6));
              const token = json.choices?.[0]?.delta?.content || "";
              if (token) {
                assistantText += token;
                setMessages(prev => {
                  const last = [...prev];
                  last[last.length - 1] = { role: "assistant", content: assistantText };
                  return last;
                });
              }
            } catch {
              // Ignore partial JSON parse errors in chunk stream
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => {
        const last = [...prev];
        last[last.length - 1] = {
          role: "assistant",
          content: "⚠️ *Connection error to Groq AI inference engine. Please check your network or key configuration.*",
        };
        return last;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button in Bottom Right */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999 }}>
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen(v => !v)}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 30,
            padding: "12px 20px",
            color: "white",
            fontWeight: 800,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            boxShadow: "0 0 30px rgba(139,92,246,0.5), 0 8px 24px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: 16 }}>✦</span>
          <span>TrustSync Copilot</span>
          <span style={{
            fontSize: 9, background: "rgba(255,255,255,0.2)", padding: "2px 7px", borderRadius: 10,
            fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
          }}>Groq AI</span>
        </motion.button>
      </div>

      {/* Floating AI Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: "fixed",
              bottom: 84,
              right: 28,
              width: 440,
              height: 600,
              background: "#0c0d12",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 20,
              overflow: "hidden",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(139,92,246,0.2)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "16px 20px",
              background: "linear-gradient(180deg, rgba(139,92,246,0.12), transparent)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "white",
                }}>✦</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--white)" }}>TrustSync Copilot</div>
                  <div style={{ fontSize: 10, color: "var(--purple)", fontFamily: "JetBrains Mono, monospace" }}>
                    ⚡ LLaMA-3.3 70B (Groq Engine)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 20, lineHeight: 1,
                }}
              >×</button>
            </div>

            {/* Message Area */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "88%",
                      padding: "12px 16px",
                      borderRadius: 14,
                      fontSize: 13,
                      lineHeight: 1.6,
                      background: msg.role === "user" ? "var(--blue)" : "rgba(255,255,255,0.04)",
                      color: msg.role === "user" ? "white" : "var(--text2)",
                      border: msg.role === "user" ? "none" : "1px solid var(--border2)",
                      whiteSpace: "pre-wrap",
                      fontFamily: msg.role === "user" ? "Inter, sans-serif" : "Inter, sans-serif",
                    }}
                  >
                    <FormattedMessage content={msg.content} />
                    {isLoading && i === messages.length - 1 && (
                      <span className="pulse-dot blue" style={{ marginLeft: 6, display: "inline-block" }} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            {messages.length < 3 && (
              <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, overflowX: "auto" }}>
                {QUICK_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(p)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 12,
                      background: "rgba(139,92,246,0.08)",
                      border: "1px solid rgba(139,92,246,0.2)",
                      color: "var(--purple)",
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form */}
            <form
              onSubmit={e => { e.preventDefault(); handleSend(); }}
              style={{
                padding: 12,
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about XGBoost, LSTM, Celery, or FinOps..."
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--border2)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "white",
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="btn btn-primary"
                style={{
                  padding: "10px 16px",
                  fontSize: 12,
                  borderRadius: 10,
                  opacity: isLoading || !input.trim() ? 0.5 : 1,
                }}
              >
                Send
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Simple Markdown Formatter for Gemini-like structured rendering
function FormattedMessage({ content }: { content: string }) {
  if (!content) return null;

  // Highlight bold text **bold**
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index} style={{ color: "var(--white)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </span>
  );
}
