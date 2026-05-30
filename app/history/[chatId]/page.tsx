"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../components/AuthProvider";
import { appendChatMessages, getChat } from "../../lib/records";
import type { ChatRecord } from "../../lib/types";
import { Timestamp } from "firebase/firestore";

const getAssistantReply = async (
  prompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, messages }),
  });

  const data = (await response.json()) as { answer?: string; error?: string };

  if (!response.ok || !data.answer) {
    throw new Error(data.error || "Could not generate response.");
  }

  return data.answer;
};

export default function ChatDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ chatId: string }>();
  const [chat, setChat] = useState<ChatRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !params.chatId) {
      return;
    }

    getChat(user.uid, params.chatId)
      .then(setChat)
      .finally(() => setLoading(false));
  }, [params.chatId, user]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length, sending]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!user || !params.chatId || !chat || !trimmedMessage || sending) {
      return;
    }

    const now = Timestamp.fromDate(new Date());
    const userMessage = { role: "user" as const, content: trimmedMessage, createdAt: now };
    const optimisticChat = {
      ...chat,
      messages: [...chat.messages, userMessage],
    };

    setChat(optimisticChat);
    setMessage("");
    setSending(true);
    setError("");

    try {
      const assistantReply = await getAssistantReply(
        trimmedMessage,
        chat.messages.map((item) => ({ role: item.role, content: item.content })),
      );
      const assistantMessage = {
        role: "assistant" as const,
        content: assistantReply,
        createdAt: Timestamp.fromDate(new Date()),
      };

      const updatedChat = await appendChatMessages(user.uid, params.chatId, [
        userMessage,
        assistantMessage,
      ]);
      setChat(updatedChat);
    } catch (sendError) {
      setChat(chat);
      setError(sendError instanceof Error ? sendError.message : "Could not send message.");
      setMessage(trimmedMessage);
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell pageClassName="workspace-shell">
        <section className="chat-page">
          {loading ? <div className="empty-state">Loading chat...</div> : null}
          {!loading && !chat ? <div className="empty-state">Chat not found.</div> : null}
          {chat ? (
            <>
              <div className="message-stack">
                {chat.messages.map((message, index) => (
                  <article className={`message-bubble ${message.role}`} key={`${message.role}-${index}`}>
                    <span>{message.role === "user" ? "You" : "AERO"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
                {sending ? (
                  <article className="message-bubble assistant is-thinking">
                    <span>AERO</span>
                    <p>Thinking...</p>
                  </article>
                ) : null}
                <div ref={messageEndRef} />
              </div>
              {error ? <div className="chat-error">{error}</div> : null}
              <form className="chat-compose" onSubmit={sendMessage}>
                <input
                  aria-label="Message AERO"
                  placeholder="Message AERO"
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <button type="submit" disabled={sending || !message.trim()}>
                  Send
                </button>
              </form>
            </>
          ) : null}
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}
