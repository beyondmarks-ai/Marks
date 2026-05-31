"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  effects: "Which sound do you want?",
  "voice-chat": "What do you want to hear?",
  "voice-clone": "What text should become speech?",
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

const generateSoundEffect = async (prompt: string) => {
  const response = await fetch("/api/effects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || "Could not generate sound effect.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);

  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: filenameMatch?.[1] || "sound-effect.mp3",
  };
};

const generateVoiceReplyWithVoice = async (
  text: string,
  title: string,
  voiceId: string,
  speed: number,
) => {
  const response = await fetch("/api/voice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, title, voiceId, speed }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || "Could not generate voice reply.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);

  return {
    blob,
    url: URL.createObjectURL(blob),
    filename: filenameMatch?.[1] || "voice-reply.mp3",
  };
};

type AudioResult = {
  blob: Blob;
  url: string;
  filename: string;
};

const writeString = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};

const audioBufferToWav = (buffer: AudioBuffer) => {
  const channelCount = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const sampleCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const output = new ArrayBuffer(44 + sampleCount * blockAlign);
  const view = new DataView(output);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * blockAlign, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, "data");
  view.setUint32(40, sampleCount * blockAlign, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channelIndex)[sampleIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([output], { type: "audio/wav" });
};

const mixVoiceWithBackground = async (
  voiceBlob: Blob,
  backgroundBlob: Blob,
  title: string,
): Promise<AudioResult> => {
  const audioContext = new AudioContext();
  const [voiceBuffer, backgroundBuffer] = await Promise.all([
    voiceBlob.arrayBuffer().then((buffer) => audioContext.decodeAudioData(buffer)),
    backgroundBlob.arrayBuffer().then((buffer) => audioContext.decodeAudioData(buffer)),
  ]);
  await audioContext.close();

  const sampleRate = Math.max(voiceBuffer.sampleRate, backgroundBuffer.sampleRate);
  const duration = Math.max(voiceBuffer.duration + 0.5, backgroundBuffer.duration);
  const channelCount = Math.max(voiceBuffer.numberOfChannels, backgroundBuffer.numberOfChannels);
  const offlineContext = new OfflineAudioContext(channelCount, Math.ceil(duration * sampleRate), sampleRate);

  const voiceSource = offlineContext.createBufferSource();
  const voiceGain = offlineContext.createGain();
  voiceSource.buffer = voiceBuffer;
  voiceGain.gain.value = 1;
  voiceSource.connect(voiceGain).connect(offlineContext.destination);
  voiceSource.start(0.15);

  const backgroundSource = offlineContext.createBufferSource();
  const backgroundGain = offlineContext.createGain();
  backgroundSource.buffer = backgroundBuffer;
  backgroundSource.loop = backgroundBuffer.duration < duration;
  backgroundGain.gain.setValueAtTime(0, 0);
  backgroundGain.gain.linearRampToValueAtTime(0.28, 0.45);
  backgroundGain.gain.setValueAtTime(0.28, Math.max(0.45, duration - 0.75));
  backgroundGain.gain.linearRampToValueAtTime(0, duration);
  backgroundSource.connect(backgroundGain).connect(offlineContext.destination);
  backgroundSource.start(0);
  backgroundSource.stop(duration);

  const mixedBuffer = await offlineContext.startRendering();
  const mixedBlob = audioBufferToWav(mixedBuffer);
  const filename = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "voice-scene"}.wav`;

  return {
    blob: mixedBlob,
    url: URL.createObjectURL(mixedBlob),
    filename,
  };
};

type VoiceOption = {
  id: string;
  name: string;
  category?: string;
};

const loadVoices = async () => {
  const response = await fetch("/api/voices");
  const data = (await response.json()) as { voices?: VoiceOption[]; error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Could not load voices.");
  }

  return data.voices ?? [];
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<PromptMode>("chat");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [soundResult, setSoundResult] = useState<{ url: string; filename: string } | null>(null);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<"image" | "video" | null>(null);
  const [videoSeconds, setVideoSeconds] = useState<VideoSeconds>("4");
  const [videoRatio, setVideoRatio] = useState<VideoRatio>("16:9");
  const [mediaVisibility, setMediaVisibility] = useState<MediaVisibility>("public");
  const footerRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  const closeMenu = useCallback(() => {
    if (!menuOpen || menuClosing) {
      return;
    }

    setMenuClosing(true);
    window.setTimeout(() => {
      setMenuOpen(false);
      setVoiceMenuOpen(false);
      setMenuClosing(false);
    }, 180);
  }, [menuClosing, menuOpen]);

  useEffect(() => {
    return () => {
      if (soundResult?.url) {
        URL.revokeObjectURL(soundResult.url);
      }
    };
  }, [soundResult]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (footerRef.current?.contains(event.target as Node)) {
        return;
      }

      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    const isVoiceMode = promptMode === "voice-chat" || promptMode === "voice-clone";

    if (!isVoiceMode || voicesLoaded || voicesLoading) {
      return;
    }

    setVoicesLoading(true);
    loadVoices()
      .then((loadedVoices) => {
        setVoices(loadedVoices);
        setSelectedVoiceId((currentVoiceId) => currentVoiceId || loadedVoices[0]?.id || "");
        setVoicesLoaded(true);
      })
      .catch((voiceError) => {
        setVoicesLoaded(true);
        setError(voiceError instanceof Error ? voiceError.message : "Could not load voices.");
      })
      .finally(() => {
        setVoicesLoading(false);
      });
  }, [promptMode, voicesLoaded, voicesLoading]);

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
    setSoundResult(null);
    setGeneratingMode(promptMode === "image" || promptMode === "video" ? promptMode : null);

    try {
      if (promptMode === "effects") {
        const result = await generateSoundEffect(trimmedPrompt);
        setSoundResult(result);
        return;
      }

      if (promptMode === "voice-chat") {
        if (!selectedVoiceId) {
          throw new Error("Select a voice first.");
        }

        const assistantReply = await getAssistantReply(trimmedPrompt);
        const voiceResult = await generateVoiceReplyWithVoice(
          assistantReply,
          trimmedPrompt,
          selectedVoiceId,
          voiceSpeed,
        );
        const result = backgroundPrompt.trim()
          ? await mixVoiceWithBackground(
              voiceResult.blob,
              (await generateSoundEffect(backgroundPrompt.trim())).blob,
              trimmedPrompt,
            )
          : voiceResult;
        setSoundResult(result);
        return;
      }

      if (promptMode === "voice-clone") {
        if (!selectedVoiceId) {
          throw new Error("Select a voice first.");
        }

        const voiceResult = await generateVoiceReplyWithVoice(
          trimmedPrompt,
          trimmedPrompt,
          selectedVoiceId,
          voiceSpeed,
        );
        const result = backgroundPrompt.trim()
          ? await mixVoiceWithBackground(
              voiceResult.blob,
              (await generateSoundEffect(backgroundPrompt.trim())).blob,
              trimmedPrompt,
            )
          : voiceResult;
        setSoundResult(result);
        return;
      }

      if (promptMode === "chat" || promptMode === "audio") {
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

      {soundResult ? (
        <section className="sound-result" aria-label="Generated sound effect">
          <span>Generated audio</span>
          <audio src={soundResult.url} controls />
          <a href={soundResult.url} download={soundResult.filename}>
            Download
          </a>
        </section>
      ) : null}

      <form
        className={`prompt-footer${
          promptMode === "image" ||
          promptMode === "video" ||
          promptMode === "voice-chat" ||
          promptMode === "voice-clone"
            ? " has-media-settings"
            : ""
        }`}
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
            setVoiceMenuOpen(false);
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
            <button
              type="button"
              role="menuitem"
              aria-expanded={voiceMenuOpen}
              onClick={() => setVoiceMenuOpen((open) => !open)}
            >
              <img className="menu-icon" src="/icons/audio.png" alt="" />
              Audio
            </button>
            {voiceMenuOpen ? (
              <div className="voice-menu-options" role="group" aria-label="Audio options">
                <button type="button" onClick={() => selectPromptMode("voice-chat")}>
                  Chat with voice
                </button>
                <button type="button" onClick={() => selectPromptMode("voice-clone")}>
                  Clone voice
                </button>
              </div>
            ) : null}
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
        {promptMode === "voice-chat" || promptMode === "voice-clone" ? (
          <div className="voice-controls" aria-label="Voice settings">
            <select
              aria-label="Select ElevenLabs voice"
              disabled={voicesLoading || !voices.length}
              value={selectedVoiceId}
              onChange={(event) => setSelectedVoiceId(event.target.value)}
            >
              {voicesLoading ? <option>Loading voices</option> : null}
              {!voicesLoading && !voices.length ? <option>No voices found</option> : null}
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
            <label className="voice-speed-control">
              <span>{voiceSpeed.toFixed(2)}x</span>
              <input
                aria-label="Voice speed"
                max="1.2"
                min="0.7"
                step="0.05"
                type="range"
                value={voiceSpeed}
                onChange={(event) => setVoiceSpeed(Number(event.target.value))}
              />
            </label>
            <input
              className="background-effect-input"
              aria-label="Background effect"
              placeholder="Background effect"
              type="text"
              value={backgroundPrompt}
              onChange={(event) => setBackgroundPrompt(event.target.value)}
            />
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
