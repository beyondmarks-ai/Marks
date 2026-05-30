"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRecordDate } from "../lib/format";
import { listMyMedia, listPublicMedia } from "../lib/records";
import type { MediaRecord, MediaType, VideoRatio } from "../lib/types";
import { AppShell } from "./AppShell";
import { PlaceholderPreview } from "./PlaceholderPreview";
import { useAuth } from "./AuthProvider";

export function MediaGalleryPage({ type }: { type: MediaType }) {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"public" | "mine">("public");
  const [items, setItems] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratioFilter, setRatioFilter] = useState<"all" | VideoRatio>("all");
  const label = type === "image" ? "Images" : "Videos";
  const visibleItems =
    type === "video" && ratioFilter !== "all"
      ? items.filter((item) => (item.ratio || "16:9") === ratioFilter)
      : items;

  useEffect(() => {
    setLoading(true);
    setError("");

    if (tab === "mine" && authLoading) {
      return;
    }

    if (tab === "mine" && !user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const mediaRequest = tab === "mine" && user ? listMyMedia(user.uid, type) : listPublicMedia(type);

    mediaRequest
      .then(setItems)
      .catch((loadError) => {
        setItems([]);
        const message = loadError instanceof Error ? loadError.message : "";
        const isIndexBuilding =
          message.includes("requires an index") || message.includes("index is not ready yet");

        setError(
          isIndexBuilding
            ? `The public ${label.toLowerCase()} index is still building in Firestore. Try again in a few minutes.`
            : message
              ? `Could not load ${label.toLowerCase()}: ${message}`
              : `Could not load ${label.toLowerCase()}.`,
        );
      })
      .finally(() => setLoading(false));
  }, [authLoading, type, label, tab, user]);

  return (
      <AppShell pageClassName="workspace-shell">
        <section className="workspace-page">
          <div className="workspace-heading">
            <div>
              <span>Gallery</span>
              <h1>{label}</h1>
            </div>
            <div className="gallery-controls">
              <div className="gallery-filter" aria-label="Gallery visibility">
                {(["public", "mine"] as const).map((nextTab) => (
                  <button
                    className={tab === nextTab ? "is-active" : ""}
                    key={nextTab}
                    type="button"
                    onClick={() => setTab(nextTab)}
                  >
                    {nextTab === "public" ? "Public" : "Mine"}
                  </button>
                ))}
              </div>
              {type === "video" ? (
                <div className="gallery-filter" aria-label="Video ratio filter">
                  {(["all", "16:9", "9:16"] as Array<"all" | VideoRatio>).map((ratio) => (
                    <button
                      className={ratioFilter === ratio ? "is-active" : ""}
                      key={ratio}
                      type="button"
                      onClick={() => setRatioFilter(ratio)}
                    >
                      {ratio === "all" ? "All" : ratio}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {loading ? <div className="empty-state">Loading {label.toLowerCase()}...</div> : null}
          {error ? <div className="empty-state">{error}</div> : null}
          {!loading && tab === "mine" && !user ? (
            <div className="empty-state">
              Sign in to view your private and public {label.toLowerCase()}.
            </div>
          ) : null}
          {!loading && !error && !(tab === "mine" && !user) && items.length === 0 ? (
            <div className="empty-state">No saved {label.toLowerCase()} in {tab === "public" ? "Public" : "Mine"} yet.</div>
          ) : null}
          {!loading && !error && items.length > 0 && visibleItems.length === 0 ? (
            <div className="empty-state">No {ratioFilter} videos yet.</div>
          ) : null}

          <div className="gallery-grid">
            {visibleItems.map((item) => (
              <Link className="gallery-card" href={`/gallery/${type}/${item.id}`} key={item.id}>
                <PlaceholderPreview mediaUrl={item.mediaUrl} mediaDataUrl={item.mediaDataUrl} type={type} />
                <div className="gallery-card-body">
                  <strong>{item.title}</strong>
                  <p>{item.prompt}</p>
                  <div>
                    <span>
                      {type === "video" ? `${item.ratio || "16:9"} · ` : ""}By{" "}
                      {item.authorName || user?.displayName || "AERO User"}
                    </span>
                    <time>{formatRecordDate(item.updatedAt)}</time>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </AppShell>
  );
}
