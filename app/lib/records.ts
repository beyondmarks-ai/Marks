"use client";

import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { ChatRecord, MediaRecord, MediaType, MediaVisibility, UserProfile } from "./types";

const fallbackTimestamp = () => Timestamp.fromDate(new Date());

const titleFromPrompt = (prompt: string) => {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Untitled";
  }

  return normalized.length > 54 ? `${normalized.slice(0, 54)}...` : normalized;
};

const mediaFromSnapshot = (id: string, data: Omit<MediaRecord, "id">): MediaRecord => ({
  ...data,
  id,
  visibility: data.visibility ?? "private",
  createdAt: data.createdAt ?? fallbackTimestamp(),
  updatedAt: data.updatedAt ?? fallbackTimestamp(),
});

export const createChat = async (uid: string, prompt: string, assistantReply: string) => {
  const now = Timestamp.fromDate(new Date());
  const chat = {
    uid,
    title: titleFromPrompt(prompt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messages: [
      { role: "user", content: prompt, createdAt: now },
      { role: "assistant", content: assistantReply, createdAt: now },
    ],
  };

  const ref = await addDoc(collection(getDb(), "users", uid, "chats"), chat);
  return ref.id;
};

export const saveUserProfile = async (uid: string, name: string, email: string) => {
  await setDoc(
    doc(getDb(), "users", uid),
    {
      uid,
      name: name.trim(),
      email,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snapshot = await getDoc(doc(getDb(), "users", uid));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as UserProfile;
  return {
    ...data,
    uid,
    createdAt: data.createdAt ?? fallbackTimestamp(),
    updatedAt: data.updatedAt ?? fallbackTimestamp(),
  };
};

export const createMedia = async (
  uid: string,
  type: MediaType,
  prompt: string,
  generated?: {
    mediaUrl?: string;
    jobId?: string;
    ratio?: "16:9" | "9:16";
    status?: "placeholder" | "queued" | "generating" | "ready" | "failed";
    authorName?: string;
    title?: string;
    visibility?: MediaVisibility;
  },
) => {
  const media = {
    uid,
    type,
    prompt,
    visibility: generated?.visibility || "public",
    title: generated?.title || (type === "image" ? "Image creation" : "Video creation"),
    authorName: generated?.authorName || "AERO User",
    status: generated?.status || (generated?.mediaUrl ? "ready" : "placeholder"),
    previewTheme: type === "image" ? "red-wave" : "silver-motion",
    ...(generated?.mediaUrl ? { mediaUrl: generated.mediaUrl } : {}),
    ...(generated?.jobId ? { jobId: generated.jobId } : {}),
    ...(generated?.ratio ? { ratio: generated.ratio } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(getDb(), "users", uid, "media"), media);
  return ref.id;
};

export const updateMediaGeneration = async (
  uid: string,
  mediaId: string,
  generated: {
    mediaUrl?: string;
    status?: "placeholder" | "queued" | "generating" | "ready" | "failed";
  },
) => {
  await updateDoc(doc(getDb(), "users", uid, "media", mediaId), {
    ...generated,
    updatedAt: serverTimestamp(),
  });
};

export const listChats = async (uid: string): Promise<ChatRecord[]> => {
  const snapshot = await getDocs(
    query(collection(getDb(), "users", uid, "chats"), orderBy("updatedAt", "desc"), limit(50)),
  );

  return snapshot.docs.map((item) => {
    const data = item.data() as Omit<ChatRecord, "id">;
    return {
      ...data,
      id: item.id,
      createdAt: data.createdAt ?? fallbackTimestamp(),
      updatedAt: data.updatedAt ?? fallbackTimestamp(),
      messages: data.messages ?? [],
    };
  });
};

export const getChat = async (uid: string, chatId: string): Promise<ChatRecord | null> => {
  const snapshot = await getDoc(doc(getDb(), "users", uid, "chats", chatId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<ChatRecord, "id">;
  return {
    ...data,
    id: snapshot.id,
    createdAt: data.createdAt ?? fallbackTimestamp(),
    updatedAt: data.updatedAt ?? fallbackTimestamp(),
    messages: data.messages ?? [],
  };
};

export const appendChatMessages = async (
  uid: string,
  chatId: string,
  messages: ChatRecord["messages"],
) => {
  const chat = await getChat(uid, chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }

  const updatedMessages = [...chat.messages, ...messages];
  await updateDoc(doc(getDb(), "users", uid, "chats", chatId), {
    messages: updatedMessages,
    updatedAt: serverTimestamp(),
  });

  return {
    ...chat,
    messages: updatedMessages,
    updatedAt: Timestamp.fromDate(new Date()),
  };
};

export const deleteChat = async (uid: string, chatId: string) => {
  await deleteDoc(doc(getDb(), "users", uid, "chats", chatId));
};

export const listMedia = async (uid: string, type: MediaType): Promise<MediaRecord[]> => {
  const snapshot = await getDocs(
    query(collection(getDb(), "users", uid, "media"), orderBy("updatedAt", "desc"), limit(80)),
  );

  return snapshot.docs
    .map((item) => mediaFromSnapshot(item.id, item.data() as Omit<MediaRecord, "id">))
    .filter((item) => item.type === type);
};

export const listMyMedia = listMedia;

export const listPublicMedia = async (type: MediaType): Promise<MediaRecord[]> => {
  const snapshot = await getDocs(
    query(
      collectionGroup(getDb(), "media"),
      where("visibility", "==", "public"),
      limit(120),
    ),
  );

  return snapshot.docs
    .map((item) => mediaFromSnapshot(item.id, item.data() as Omit<MediaRecord, "id">))
    .filter((item) => item.type === type)
    .sort((left, right) => right.updatedAt.toMillis() - left.updatedAt.toMillis());
};

export const getPublicMedia = async (
  type: MediaType,
  mediaId: string,
): Promise<MediaRecord | null> => {
  const snapshot = await getDocs(
    query(
      collectionGroup(getDb(), "media"),
      where("visibility", "==", "public"),
      limit(120),
    ),
  );
  const matchedDoc = snapshot.docs.find((item) => item.id === mediaId);

  if (!matchedDoc) {
    return null;
  }

  const data = matchedDoc.data() as Omit<MediaRecord, "id">;
  if (data.type !== type || data.visibility !== "public") {
    return null;
  }

  return mediaFromSnapshot(matchedDoc.id, data);
};

export const getMedia = async (
  uid: string,
  type: MediaType,
  mediaId: string,
): Promise<MediaRecord | null> => {
  const snapshot = await getDoc(doc(getDb(), "users", uid, "media", mediaId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<MediaRecord, "id">;
  if (data.type !== type) {
    return null;
  }

  return mediaFromSnapshot(snapshot.id, data);
};

export const updateMediaTitle = async (uid: string, mediaId: string, title: string) => {
  const nextTitle = title.trim();
  if (!nextTitle) {
    throw new Error("Title is required.");
  }

  await updateDoc(doc(getDb(), "users", uid, "media", mediaId), {
    title: nextTitle,
    updatedAt: serverTimestamp(),
  });
};

export const deleteMedia = async (uid: string, mediaId: string) => {
  await deleteDoc(doc(getDb(), "users", uid, "media", mediaId));
};
