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

// Custom TrustSync Shield Logo
function TrustSyncLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" fill="url(#ts-grad)" opacity="0.18" />
      <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" stroke="url(#ts-grad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="url(#ts-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="ts-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// 3-Dot Animated Loading Indicator
function TypingDots() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 2px" }}>
      <motion.span
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
        style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }}
      />
      <motion.span
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", display: "inline-block" }}
      />
      <motion.span
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", display: "inline-block" }}
      />
    </div>
  );
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hello! I am **TrustSync.AI**, your intelligent payment resilience assistant.\n\nAsk me anything about **XGBoost anomaly triage**, **LSTM recovery prediction**, **Celery smart vaulting**, or **FinOps cost optimization**!",
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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to TrustSync.AI server");
      }

      // Add empty assistant message to stream into
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ *Connection error to TrustSync.AI inference server. Please check your network or configuration.*",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Logo Button (Disappears when Chat Window is Open) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999 }}
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsOpen(true)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border2)",
                borderRadius: 10,
                padding: "8px 14px",
                color: "var(--white)",
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(59,130,246,0.15)",
              }}
            >
              <TrustSyncLogo size={18} />
              <span>TrustSync.AI</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating AI Chat Window (Opens cleanly from bottom right) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              width: 440,
              height: 580,
              background: "#0c0d12",
              border: "1px solid var(--border2)",
              borderRadius: 12,
              overflow: "hidden",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 16px 48px rgba(0,0,0,0.8), 0 0 24px rgba(59,130,246,0.12)",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "14px 18px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TrustSyncLogo size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--white)", lineHeight: 1.2 }}>TrustSync.AI</div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>
                    Intelligent Payment Resilience
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
                }}
              >✕</button>
            </div>

            {/* Message Area */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
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
                      maxWidth: "92%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: msg.role === "user" ? "var(--blue)" : "rgba(255,255,255,0.03)",
                      color: msg.role === "user" ? "white" : "var(--text)",
                      border: msg.role === "user" ? "none" : "1px solid var(--border)",
                      wordBreak: "break-word",
                    }}
                  >
                    <FormattedMessage content={msg.content} />
                  </div>
                </div>
              ))}

              {/* 3-Dot Animating Typing Indicator when loading */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <TypingDots />
                  </div>
                </div>
              )}

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
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(59,130,246,0.2)",
                      color: "var(--blue)",
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
                placeholder="Ask TrustSync.AI..."
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--border2)",
                  borderRadius: 8,
                  padding: "8px 12px",
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
                  padding: "8px 14px",
                  fontSize: 12,
                  borderRadius: 8,
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

// Structured Markdown Formatter (Code Blocks, Headings, Lists, Inline Code, Bold)
function FormattedMessage({ content }: { content: string }) {
  if (!content) return null;

  // Split into code blocks vs text blocks
  const parts = content.split(/(```[a-zA-Z0-9_-]*[\s\S]*?(?:```|$))/g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {parts.map((part, idx) => {
        if (!part) return null;

        // Code block formatting
        if (part.startsWith("```")) {
          const firstNewLine = part.indexOf("\n");
          let lang = "code";
          let codeText = "";
          if (firstNewLine !== -1) {
            lang = part.substring(3, firstNewLine).trim() || "code";
            let rawCode = part.substring(firstNewLine + 1);
            if (rawCode.endsWith("```")) {
              rawCode = rawCode.slice(0, -3);
            }
            codeText = rawCode;
          } else {
            lang = part.substring(3).trim() || "code";
          }

          return (
            <div
              key={idx}
              style={{
                background: "#08080d",
                border: "1px solid var(--border2)",
                borderRadius: 6,
                overflow: "hidden",
                margin: "4px 0",
              }}
            >
              <div
                style={{
                  padding: "3px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#a78bfa",
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase",
                }}
              >
                {lang}
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "10px 12px",
                  fontSize: 11.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#e2e8f0",
                  overflowX: "auto",
                  lineHeight: 1.5,
                  whiteSpace: "pre",
                  wordBreak: "normal",
                }}
              >
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // Regular Markdown text (headings, list items, paragraphs)
        return <InlineMarkdownBlock key={idx} text={part} />;
      })}
    </div>
  );
}

function InlineMarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} style={{ height: 2 }} />;

        // Headings (# , ## , ### )
        if (trimmed.startsWith("#")) {
          const level = trimmed.match(/^#+/)?.[0].length || 1;
          const headingText = trimmed.replace(/^#+\s*/, "");
          return (
            <div
              key={lineIdx}
              style={{
                fontSize: level === 1 ? 14 : level === 2 ? 13.5 : 13,
                fontWeight: 700,
                color: "var(--white)",
                marginTop: 6,
                marginBottom: 2,
              }}
            >
              <RenderInlineElements text={headingText} />
            </div>
          );
        }

        // Bullet point list items (- or * or 1. )
        if (trimmed.match(/^[-*]\s/) || trimmed.match(/^\d+\.\s/)) {
          const listText = trimmed.replace(/^([-*]|\d+\.)\s*/, "");
          return (
            <div
              key={lineIdx}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
                paddingLeft: 4,
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "var(--blue)", fontWeight: 700 }}>•</span>
              <div style={{ flex: 1 }}>
                <RenderInlineElements text={listText} />
              </div>
            </div>
          );
        }

        // Regular line
        return (
          <div key={lineIdx} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <RenderInlineElements text={line} />
          </div>
        );
      })}
    </div>
  );
}

function RenderInlineElements({ text }: { text: string }) {
  if (!text) return null;

  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} style={{ color: "var(--white)", fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={index}
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "#60a5fa",
                padding: "2px 5px",
                borderRadius: 4,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.9em",
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
}
