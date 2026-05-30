"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../components/AuthProvider";
import { formatRecordDate } from "../lib/format";
import { deleteChat, listChats } from "../lib/records";
import type { ChatRecord } from "../lib/types";

export default function HistoryPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    listChats(user.uid)
      .then(setChats)
      .catch(() => setError("Could not load chat history. Check Firestore rules."))
      .finally(() => setLoading(false));
  }, [user]);

  const removeChat = async (chatId: string) => {
    if (!user) {
      return;
    }

    setChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    await deleteChat(user.uid, chatId);
  };

  return (
    <ProtectedRoute>
      <AppShell pageClassName="workspace-shell">
        <section className="workspace-page">
          <div className="workspace-heading">
            <span>History</span>
            <h1>Chat history</h1>
          </div>
          <div className="record-list">
            {loading ? <div className="empty-state">Loading chats...</div> : null}
            {error ? <div className="empty-state">{error}</div> : null}
            {!loading && chats.length === 0 ? (
              <div className="empty-state">No saved chats yet.</div>
            ) : null}
            {chats.map((chat) => (
              <div className="history-row" key={chat.id}>
                <Link className="history-link" href={`/history/${chat.id}`}>
                  <div>
                    <strong>{chat.title}</strong>
                    <p>{chat.messages[0]?.content || "Saved chat"}</p>
                  </div>
                  <time>{formatRecordDate(chat.updatedAt)}</time>
                </Link>
                <button
                  className="history-delete"
                  type="button"
                  aria-label={`Delete ${chat.title}`}
                  onClick={() => removeChat(chat.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}
