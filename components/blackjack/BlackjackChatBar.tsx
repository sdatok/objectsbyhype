"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicBlackjackChatMessage } from "@/lib/blackjack-types";

interface BlackjackChatBarProps {
  roundId: string | null;
  email: string;
  displayName: string;
  enabled: boolean;
}

export default function BlackjackChatBar({
  roundId,
  email,
  displayName,
  enabled,
}: BlackjackChatBarProps) {
  const [messages, setMessages] = useState<PublicBlackjackChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);

  const refreshChat = useCallback(async () => {
    if (!roundId || !enabled) return;
    const q = new URLSearchParams({ roundId });
    if (email) q.set("email", email);
    if (lastTsRef.current > 0) q.set("after", String(lastTsRef.current));

    const res = await fetch(`/api/blackjack/chat?${q}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { messages?: PublicBlackjackChatMessage[] };
    const incoming = json.messages ?? [];
    if (incoming.length === 0) return;

    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of incoming) {
        if (!ids.has(m.id)) merged.push(m);
      }
      return merged.slice(-60);
    });

    const last = incoming[incoming.length - 1];
    if (last) {
      lastTsRef.current = new Date(last.createdAt).getTime();
    }
  }, [roundId, email, enabled]);

  useEffect(() => {
    if (!roundId) {
      setMessages([]);
      lastTsRef.current = 0;
      return;
    }
    void refreshChat();
    const id = setInterval(() => void refreshChat(), 2500);
    return () => clearInterval(id);
  }, [roundId, refreshChat]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!roundId || !email.trim() || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/blackjack/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          email: email.trim().toLowerCase(),
          displayName: displayName.trim() || email.split("@")[0],
          message: draft,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: PublicBlackjackChatMessage;
      };
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      if (json.message) {
        setMessages((prev) => [...prev.slice(-59), json.message!]);
        lastTsRef.current = new Date(json.message.createdAt).getTime();
      }
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bj-chat-bar shrink-0">
      <div ref={scrollRef} className="bj-chat-messages">
        {messages.length === 0 ? (
          <p className="bj-chat-empty">Table chat — say hi to the room</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`bj-chat-line ${m.isViewer ? "bj-chat-mine" : ""}`}
            >
              <span className="bj-chat-name">{m.displayName}</span>
              <span className="bj-chat-body">{m.body}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={sendMessage} className="bj-chat-form">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          placeholder={
            enabled && roundId
              ? email
                ? "Message the table…"
                : "Enter email above to chat"
              : "Chat offline"
          }
          disabled={!enabled || !roundId || !email.trim() || sending}
          className="bj-chat-input"
        />
        <button
          type="submit"
          disabled={
            !enabled || !roundId || !email.trim() || !draft.trim() || sending
          }
          className="bj-chat-send"
        >
          Send
        </button>
      </form>
      {error && <p className="bj-chat-error">{error}</p>}
    </div>
  );
}
