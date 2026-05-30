import type { Timestamp } from "firebase/firestore";

export type PromptMode = "chat" | "image" | "video" | "audio" | "effects" | "voice-chat" | "voice-clone";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: Timestamp;
};

export type ChatRecord = {
  id: string;
  uid: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  messages: ChatMessage[];
};

export type MediaType = "image" | "video";

export type MediaVisibility = "public" | "private";

export type VideoSeconds = "4" | "8" | "12";

export type VideoRatio = "16:9" | "9:16";

export type MediaStatus = "placeholder" | "queued" | "generating" | "ready" | "failed";

export type MediaRecord = {
  id: string;
  uid: string;
  type: MediaType;
  prompt: string;
  title: string;
  authorName?: string;
  visibility: MediaVisibility;
  status: MediaStatus;
  previewTheme: string;
  mediaUrl?: string;
  mediaDataUrl?: string;
  jobId?: string;
  ratio?: VideoRatio;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
