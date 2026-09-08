import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

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

// Demo mode when any required key is missing or still a placeholder.
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
let authInstance: Auth | null = null;

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
  // College WiFi often blocks websockets. Force long-polling so the wall
  // still updates behind captive portals and aggressive proxies.
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
  authInstance = getAuth(app);
}

export const firebaseApp: FirebaseApp | null = app;
export const db: Firestore | null = dbInstance;
export const auth: Auth | null = authInstance;

const parsedPoll = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? "5000");
export const POLL_INTERVAL_MS =
  Number.isFinite(parsedPoll) && parsedPoll >= 2000 ? parsedPoll : 5000;
