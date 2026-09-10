import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? "";
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? "";
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? "";
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? "";
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "";
const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? "";

function looksPlaceholder(value: string): boolean {
  if (!value) return true;
  const lowered = value.toLowerCase();
  return (
    lowered.includes("placeholder") ||
    lowered.includes("example") ||
    lowered.includes("changeme") ||
    lowered.includes("your-")
  );
}

// Live-only: when any required key is missing or still a placeholder the app
// shows a config-required error with zero rows. No local sample rows.
// Required for live mode: apiKey + authDomain + projectId + appId.
// storageBucket / messagingSenderId are optional for Firestore-only MVP.
export const isFirebaseConfigured =
  apiKey.length > 0 &&
  authDomain.length > 0 &&
  projectId.length > 0 &&
  appId.length > 0 &&
  ![apiKey, authDomain, projectId, appId].some(looksPlaceholder);

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  const existing = getApps().length > 0 ? getApp() : null;
  app =
    existing ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket: storageBucket || undefined,
      messagingSenderId: messagingSenderId || undefined,
      appId,
    });
  const rawLongPoll = String(import.meta.env.VITE_FIRESTORE_LONG_POLL ?? "").toLowerCase().trim();
  const forceLongPoll = ["force", "true", "1"].includes(rawLongPoll);
  if (import.meta.env.DEV && forceLongPoll) {
    console.debug("[firestore] long-polling enabled via VITE_FIRESTORE_LONG_POLL");
  }
  try {
    dbInstance = forceLongPoll
      ? initializeFirestore(app, { experimentalForceLongPolling: true })
      : initializeFirestore(app, {});
  } catch {
    // HMR guard: Firestore already initialized in this session, reuse it.
    try {
      dbInstance = getFirestore(app);
    } catch {
      dbInstance = null;
    }
  }
}

export const firebaseApp: FirebaseApp | null = app;
export const db: Firestore | null = dbInstance;

/**
 * Lazy Admin-only Auth loader. Keeps `firebase/auth` (and its
 * Identity Toolkit getProjectConfig / iframe.js fetch) out of the
 * `/` and `/wall` bundles. Call only from Admin route.
 */
export async function loadAdminAuth(): Promise<Auth> {
  if (!isFirebaseConfigured || !app) {
    throw new Error("Live setup required: Firebase env is missing.");
  }
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

const parsedPoll = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? "5000");
export const POLL_INTERVAL_MS =
  Number.isFinite(parsedPoll) && parsedPoll >= 2000 ? parsedPoll : 5000;
