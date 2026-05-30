"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getStorageInstance } from "./firebase";
import type { MediaType } from "./types";

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const uploadGeneratedMedia = async (
  uid: string,
  type: MediaType,
  dataUrl: string,
) => {
  const blob = await dataUrlToBlob(dataUrl);
  const extension = blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png";
  const path = `users/${uid}/media/${type}-${Date.now()}.${extension}`;
  const storageRef = ref(getStorageInstance(), path);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || "image/png",
  });

  return getDownloadURL(storageRef);
};
