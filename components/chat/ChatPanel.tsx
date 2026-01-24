"use client";

import { useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

interface ChatPanelProps {
  title: string;
  placeholder?: string;
}

export function ChatPanel({ title, placeholder }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "Upload a floor plan on the left and tell me about the vibe you want."
    }
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    const nextId = messages[messages.length - 1]?.id + 1 || 1;
    setMessages((prev) => [
      ...prev,
      { id: nextId, role: "user", content: input.trim() }
    ]);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className="panel flex flex-col flex-1 min-h-[360px] max-h-[calc(100vh-96px)]">
      <div className="panel-header">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
            Chat
          </p>
          <p className="text-sm text-white/80">{title}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col panel-body gap-3">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                m.role === "assistant"
                  ? "bg-white/5 text-white/90"
                  : "bg-accent/80 text-white ml-auto"
              }`}
            >
              {m.content}
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-xs text-white/40">
              Start the conversation by describing your goals.
            </p>
          )}
        </div>
        <div className="border border-white/10 rounded-2xl bg-black/40 px-3 py-2 flex flex-col gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Ask for layout, style, or constraints..."}
            className="bg-transparent resize-none outline-none text-xs text-white/90 max-h-24 placeholder:text-white/30"
            rows={2}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/35">
              Press Enter to send, Shift+Enter for a new line.
            </p>
            <button
              type="button"
              onClick={sendMessage}
              className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-white shadow-md hover:bg-accent/90 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}




