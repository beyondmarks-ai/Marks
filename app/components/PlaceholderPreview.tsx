import type { MediaType } from "../lib/types";

export function PlaceholderPreview({
  mediaUrl,
  mediaDataUrl,
  progress,
  status,
  type,
  size = "card",
}: {
  mediaUrl?: string;
  mediaDataUrl?: string;
  progress?: number | null;
  status?: string;
  type: MediaType;
  size?: "card" | "hero";
}) {
  const source = mediaUrl || mediaDataUrl;

  if (source && type === "image") {
    return <img className={`generated-media generated-media-${size}`} src={source} alt="" />;
  }

  if (source && type === "video") {
    return (
      <video className={`generated-media generated-media-${size}`} src={source} controls={size === "hero"} />
    );
  }

  if (type === "video" && size === "hero") {
    const fallbackProgress = status === "queued" ? 1 : 5;
    const displayProgress = Math.max(0, Math.min(100, progress ?? fallbackProgress));
    const progressLabel = Math.round(displayProgress);

    return (
      <div className="video-progress-preview">
        <div className="video-progress-copy">
          <span>{status === "queued" ? "Queued" : "Generating video"}</span>
          <strong>{progressLabel}%</strong>
        </div>
        <div className="video-progress-track" aria-hidden="true">
          <span style={{ width: `${displayProgress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`placeholder-preview placeholder-preview-${type} placeholder-preview-${size}`}>
      {type === "video" ? <span aria-hidden="true" /> : null}
    </div>
  );
}
