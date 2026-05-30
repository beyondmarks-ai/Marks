"use client";

import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

const assertFirebaseReady = () => {
  if (!firebaseReady) {
    throw new Error("Firebase environment variables are missing.");
  }
};

export const getFirebaseApp = () => {
  assertFirebaseReady();
  firebaseApp = firebaseApp ?? (getApps().length ? getApp() : initializeApp(firebaseConfig));
  return firebaseApp;
};

export const getAuthInstance = () => {
  auth = auth ?? getAuth(getFirebaseApp());
  return auth;
};

export const getDb = () => {
  db = db ?? getFirestore(getFirebaseApp());
  return db;
};

export const getStorageInstance = () => {
  storage = storage ?? getStorage(getFirebaseApp());
  return storage;
};

export const getGoogleProvider = () => {
  googleProvider = googleProvider ?? new GoogleAuthProvider();
  return googleProvider;
};
