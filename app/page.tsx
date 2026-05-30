"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./components/AuthProvider";
import { createChat, createMedia } from "./lib/records";
import { uploadGeneratedMedia } from "./lib/storage";
import type { MediaVisibility, PromptMode, VideoRatio, VideoSeconds } from "./lib/types";

const promptCopy: Record<PromptMode, string> = {
  chat: "What do you want to know?",
  image: "What do you want to create?",
  video: "What do you want to create?",
  audio: "Which sound do you want?",
  effects: "Which effect do you want?",
};

const getAssistantReply = async (
  prompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
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

const generateMedia = async (
  type: "image" | "video",
  prompt: string,
  seconds: VideoSeconds,
  ratio: VideoRatio,
) => {
  const response = await fetch(`/api/${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(type === "video" ? { prompt, seconds, ratio } : { prompt }),
  });

  const data = (await response.json()) as {
    mediaUrl?: string;
    mediaDataUrl?: string;
    jobId?: string;
    ratio?: VideoRatio;
    status?: "placeholder" | "queued" | "generating" | "ready" | "failed";
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Could not generate ${type}.`);
  }

  return data;
};

const suggestTitle = async (type: "image" | "video", prompt: string) => {
  const response = await fetch("/api/title", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type, prompt }),
  });

  const data = (await response.json()) as { title?: string; error?: string };

  if (!response.ok || !data.title) {
    return type === "image" ? "Image creation" : "Video creation";
  }

  return data.title;
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>("chat");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generatingMode, setGeneratingMode] = useState<"image" | "video" | null>(null);
  const [videoSeconds, setVideoSeconds] = useState<VideoSeconds>("4");
  const [videoRatio, setVideoRatio] = useState<VideoRatio>("16:9");
  const [mediaVisibility, setMediaVisibility] = useState<MediaVisibility>("public");
  const footerRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  const closeMenu = () => {
    if (!menuOpen || menuClosing) {
      return;
    }

    setMenuClosing(true);
    window.setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
    }, 180);
  };

  const selectPromptMode = (mode: PromptMode) => {
    setPromptMode(mode);
    closeMenu();
  };

  const submitPrompt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!user || !trimmedPrompt || saving) {
      return;
    }

    setSaving(true);
    setError("");
    setGeneratingMode(promptMode === "image" || promptMode === "video" ? promptMode : null);

    try {
      if (promptMode === "chat" || promptMode === "audio" || promptMode === "effects") {
        const assistantReply = await getAssistantReply(trimmedPrompt);
        const chatId = await createChat(user.uid, trimmedPrompt, assistantReply);
        router.push(`/history/${chatId}`);
        return;
      }

      const [generatedMedia, suggestedTitle] = await Promise.all([
        generateMedia(promptMode, trimmedPrompt, videoSeconds, videoRatio),
        suggestTitle(promptMode, trimmedPrompt),
      ]);
      const mediaUrl =
        generatedMedia.mediaUrl ||
        (generatedMedia.mediaDataUrl
          ? await uploadGeneratedMedia(user.uid, promptMode, generatedMedia.mediaDataUrl)
          : undefined);
      const mediaId = await createMedia(user.uid, promptMode, trimmedPrompt, {
        ...generatedMedia,
        mediaUrl,
        authorName: user.displayName || "AERO User",
        title: suggestedTitle,
        visibility: mediaVisibility,
        ratio: promptMode === "video" ? videoRatio : undefined,
        status:
          generatedMedia.status ||
          (mediaUrl ? "ready" : "generating"),
      });
      router.push(`/gallery/${promptMode}/${mediaId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this prompt.");
    } finally {
      setSaving(false);
      setGeneratingMode(null);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell pageClassName="home-shell">
      <header className="site-header" aria-label="Logo">
        <img src="/logo.png" alt="Logo" />
        <div className="logo-title" aria-label="AERO">
          AERO
        </div>
      </header>

      {error ? <div className="home-error">{error}</div> : null}

      {generatingMode ? (
        <div className="generation-modal-backdrop" role="status" aria-live="polite">
          <div className="generation-modal">
            <div className="generation-copy">
              <span>AERO {generatingMode === "image" ? "Image" : "Video"}</span>
              <strong>
                {generatingMode === "image" ? "Creating your image" : "Preparing your video"}
              </strong>
              <p>
                {generatingMode === "image"
                  ? "Rendering the visual from your prompt. This can take a moment."
                  : "Starting the Sora generation job. Video requests can take longer than images."}
              </p>
            </div>
            <div className="generation-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      ) : null}

      <form
        className={`prompt-footer${promptMode === "image" || promptMode === "video" ? " has-media-settings" : ""}`}
        aria-label="Prompt input"
        ref={footerRef}
        onSubmit={submitPrompt}
      >
        <button
          className="icon-button plus-button"
          aria-label="Add"
          aria-expanded={menuOpen}
          aria-controls="add-menu"
          onClick={() => {
            if (menuOpen) {
              closeMenu();
              return;
            }

            setMenuOpen(true);
          }}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div
            className={`add-menu${menuClosing ? " is-closing" : ""}`}
            id="add-menu"
            role="menu"
          >
            <button type="button" role="menuitem" onClick={() => selectPromptMode("image")}>
              <img className="menu-icon" src="/icons/image.png" alt="" />
              Image
            </button>
            <button type="button" role="menuitem" onClick={() => selectPromptMode("video")}>
              <img className="menu-icon" src="/icons/video.png" alt="" />
              Video
            </button>
            <button type="button" role="menuitem" onClick={() => selectPromptMode("audio")}>
              <img className="menu-icon" src="/icons/audio.png" alt="" />
              Audio
            </button>
            <button type="button" role="menuitem" onClick={() => selectPromptMode("effects")}>
              <img className="menu-icon" src="/icons/effects.svg" alt="" />
              Effects
            </button>
            <button type="button" role="menuitem" onClick={() => selectPromptMode("chat")}>
              <img className="menu-icon" src="/icons/chat.png" alt="" />
              Chat
            </button>
          </div>
        ) : null}
        <input
          className="prompt-input"
          aria-label={promptCopy[promptMode]}
          placeholder={promptCopy[promptMode]}
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        {promptMode === "image" || promptMode === "video" ? (
          <div className="video-controls" aria-label="Media settings">
          <div className="duration-picker" aria-label="Media visibility">
            {(["public", "private"] as MediaVisibility[]).map((visibility) => (
              <button
                className={mediaVisibility === visibility ? "is-active" : ""}
                key={visibility}
                type="button"
                onClick={() => setMediaVisibility(visibility)}
              >
                {visibility === "public" ? "Public" : "Private"}
              </button>
            ))}
          </div>
          {promptMode === "video" ? (
            <>
              <div className="duration-picker" aria-label="Video ratio">
                {(["16:9", "9:16"] as VideoRatio[]).map((ratio) => (
                  <button
                    className={videoRatio === ratio ? "is-active" : ""}
                    key={ratio}
                    type="button"
                    onClick={() => setVideoRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="duration-picker" aria-label="Video duration">
                {(["4", "8", "12"] as VideoSeconds[]).map((seconds) => (
                  <button
                    className={videoSeconds === seconds ? "is-active" : ""}
                    key={seconds}
                    type="button"
                    onClick={() => setVideoSeconds(seconds)}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </>
          ) : null}
          </div>
        ) : null}
        <button className="voice-button" aria-label="Save prompt" type="submit" disabled={saving}>
          <span className="voice-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </form>
      </AppShell>
    </ProtectedRoute>
  );
}
