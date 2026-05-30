"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatRecordDate } from "../lib/format";
import {
  deleteMedia,
  getMedia,
  getPublicMedia,
  updateMediaGeneration,
  updateMediaTitle,
} from "../lib/records";
import type { MediaRecord, MediaStatus, MediaType } from "../lib/types";
import { AppShell } from "./AppShell";
import { PlaceholderPreview } from "./PlaceholderPreview";
import { useAuth } from "./AuthProvider";

export function MediaDetailPage({ type }: { type: MediaType }) {
  const { user, loading: authLoading } = useAuth();
  const params = useParams<{ mediaId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<MediaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [displayProgress, setDisplayProgress] = useState<number | null>(null);
  const label = type === "image" ? "Image" : "Video";
  const canManage = Boolean(user && item?.uid === user.uid);

  useEffect(() => {
    if (!params.mediaId) {
      return;
    }

    if (authLoading) {
      return;
    }

    setLoading(true);

    const mediaRequest = user
      ? getMedia(user.uid, type, params.mediaId).then(
          (ownedMedia) => ownedMedia ?? getPublicMedia(type, params.mediaId),
        )
      : getPublicMedia(type, params.mediaId);

    mediaRequest
      .then((media) => {
        setItem(media);
        setDraftTitle(media?.title || "");
      })
      .finally(() => setLoading(false));
  }, [authLoading, params.mediaId, type, user]);

  useEffect(() => {
    if (!user || !params.mediaId || !canManage || type !== "video" || !item?.jobId || item.status === "ready") {
      return undefined;
    }

    let cancelled = false;

    const pollVideo = async () => {
      try {
        const response = await fetch(`/api/video/${item.jobId}`);
        const data = (await response.json()) as {
          mediaUrl?: string;
          status?: string;
          progress?: number;
          error?: unknown;
        };

        if (!response.ok || cancelled) {
          return;
        }

        if (typeof data.progress === "number") {
          setVideoProgress(data.progress);
        }

        const nextStatus: MediaStatus =
          data.status === "completed"
            ? "ready"
            : data.status === "failed"
              ? "failed"
              : data.status === "queued"
                ? "queued"
                : "generating";

        if (nextStatus !== item.status || data.mediaUrl) {
          await updateMediaGeneration(user.uid, params.mediaId, {
            status: nextStatus,
            ...(data.mediaUrl ? { mediaUrl: data.mediaUrl } : {}),
          });

          if (!cancelled) {
            if (nextStatus === "ready") {
              setDisplayProgress(100);
            }

            setItem({
              ...item,
              status: nextStatus,
              ...(data.mediaUrl ? { mediaUrl: data.mediaUrl } : {}),
            });
          }
        }
      } catch {
        if (!cancelled) {
          setVideoProgress(null);
        }
      }
    };

    pollVideo();
    const interval = window.setInterval(pollVideo, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [canManage, item, params.mediaId, type, user]);

  useEffect(() => {
    if (type !== "video" || !item?.jobId) {
      return undefined;
    }

    if (item.status === "ready") {
      setDisplayProgress(100);
      return undefined;
    }

    setDisplayProgress((currentProgress) => currentProgress ?? (item.status === "queued" ? 1 : 5));

    const interval = window.setInterval(() => {
      setDisplayProgress((currentProgress) => {
        const current = currentProgress ?? 1;
        const reported = videoProgress ?? 0;
        const baseline = Math.max(current, reported, item.status === "queued" ? 1 : 5);

        if (baseline >= 92) {
          return baseline;
        }

        const step = baseline < 35 ? 1 : baseline < 70 ? 0.6 : 0.25;
        return Math.min(92, Number((baseline + step).toFixed(2)));
      });
    }, 1400);

    return () => {
      window.clearInterval(interval);
    };
  }, [item?.jobId, item?.status, type, videoProgress]);

  const removeItem = async () => {
    if (!user || !params.mediaId || !canManage) {
      return;
    }

    await deleteMedia(user.uid, params.mediaId);
    router.push(`/gallery/${type}s`);
  };

  const saveTitle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTitle = draftTitle.trim();
    if (!user || !params.mediaId || !item || !canManage || !nextTitle || savingTitle) {
      return;
    }

    setSavingTitle(true);
    setTitleError("");

    try {
      await updateMediaTitle(user.uid, params.mediaId, nextTitle);
      setItem({ ...item, title: nextTitle });
      setEditingTitle(false);
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "Could not update title.");
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <AppShell pageClassName="workspace-shell">
        <section className="workspace-page detail-page">
          {loading ? <div className="empty-state">Loading {label.toLowerCase()}...</div> : null}
          {!loading && !item ? <div className="empty-state">{label} not found.</div> : null}
          {item ? (
            <>
              <div className="workspace-heading detail-heading">
                <div>
                  <span>{label} prompt</span>
                  {editingTitle && canManage ? (
                    <form className="title-edit-form" onSubmit={saveTitle}>
                      <input
                        aria-label="Media title"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        autoFocus
                      />
                      <button type="submit" disabled={savingTitle || !draftTitle.trim()}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftTitle(item.title);
                          setEditingTitle(false);
                          setTitleError("");
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="editable-title">
                      <h1>{item.title}</h1>
                      {canManage ? (
                        <button type="button" onClick={() => setEditingTitle(true)}>
                          Edit title
                        </button>
                      ) : null}
                    </div>
                  )}
                  {titleError ? <div className="title-error">{titleError}</div> : null}
                </div>
                {canManage ? (
                  <button className="danger-button" type="button" onClick={removeItem}>
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="media-detail-layout">
                <PlaceholderPreview
                  mediaUrl={item.mediaUrl}
                  mediaDataUrl={item.mediaDataUrl}
                  progress={displayProgress ?? videoProgress}
                  status={item.status}
                  type={type}
                  size="hero"
                />
                <aside className="media-meta">
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>{label}</dd>
                    </div>
                    <div>
                      <dt>Author</dt>
                      <dd>{item.authorName || user?.displayName || "AERO User"}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatRecordDate(item.createdAt)}</dd>
                    </div>
                    {canManage ? (
                      <div>
                        <dt>Visibility</dt>
                        <dd>{item.visibility === "public" ? "Public" : "Private"}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="prompt-block">
                    <span>Prompt</span>
                    <p className={promptExpanded ? "is-expanded" : ""}>{item.prompt}</p>
                    {item.prompt.length > 140 ? (
                      <button type="button" onClick={() => setPromptExpanded((expanded) => !expanded)}>
                        {promptExpanded ? "Show less" : "Read more"}
                      </button>
                    ) : null}
                  </div>
                </aside>
              </div>
            </>
          ) : null}
        </section>
    </AppShell>
  );
}
