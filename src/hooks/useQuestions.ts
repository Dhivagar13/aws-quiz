import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../lib/firebase";
import {
  generateHandle,
  getOrCreateVoterHash,
  getVotedIds,
  markVoted,
  maskPII,
  validateBody,
} from "../lib/mask";

export type QuestionStatus = "pending" | "approved" | "rejected" | "featured";

export interface Question {
  id: string;
  body: string;
  display_handle: string;
  status: QuestionStatus;
  upvote_count: number;
  created_at: string;
}

type Scope = "wall" | "admin";

export const LIVE_CONFIG_ERROR =
  "Live setup required: Firebase env is missing. Add VITE_FIREBASE_* keys to .env and restart. Zero questions shown until configured.";

function toQuestion(id: string, data: DocumentData): Question {
  const rawCreated = data.created_at;
  let created_at: string;
  if (rawCreated && typeof rawCreated.toDate === "function") {
    try {
      created_at = rawCreated.toDate().toISOString();
    } catch {
      created_at = new Date().toISOString();
    }
  } else if (typeof rawCreated === "string") {
    created_at = rawCreated;
  } else {
    created_at = new Date().toISOString();
  }
  const status = data.status as QuestionStatus;
  return {
    id,
    body: typeof data.body === "string" ? data.body : "",
    display_handle: typeof data.display_handle === "string" ? data.display_handle : "anon-????",
    status: status === "pending" || status === "approved" || status === "rejected" || status === "featured" ? status : "pending",
    upvote_count: typeof data.upvote_count === "number" ? data.upvote_count : 0,
    created_at,
  };
}

export function sortWall(rows: Question[]): Question[] {
  return [...rows].sort((a, b) => {
    if (a.status === "featured" && b.status !== "featured") return -1;
    if (b.status === "featured" && a.status !== "featured") return 1;
    if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
    return a.created_at.localeCompare(b.created_at);
  });
}

function parseFirestoreError(e: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You are offline. Check your connection, then use Refresh to retry.";
  }
  if (!(e instanceof Error)) return "Failed to load questions.";
  const msg = e.message;
  if (msg.includes("PERMISSION_DENIED") || msg.includes("permission-denied")) {
    if (msg.includes("Cloud Firestore API has not been used") || msg.includes("disabled")) {
      return "Cloud Firestore API is not enabled on project aws-questions-inaug. Enable Firestore Database in Firebase Console.";
    }
    return "Firestore access permission denied. Check your Firestore Security Rules.";
  }
  if (msg.includes("requires an index")) {
    return "Firestore query requires an index. Deploy firestore.indexes.json or create the index in Firebase Console.";
  }
  if (msg.includes("timed out") || msg.includes("timeout")) {
    return "Connection to Firestore timed out. Retrying in background...";
  }
  return msg;
}

const FETCH_TIMEOUT_MS = 12000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function isRetryable(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return (
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("unavailable") ||
    msg.includes("network") ||
    msg.includes("failed to fetch")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useQuestions(scope: Scope) {
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<Set<string>>(() => getVotedIds());
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!isFirebaseConfigured || !db) {
      setRows([]);
      setLoading(false);
      setError(LIVE_CONFIG_ERROR);
      setLastSync(null);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      setError("You are offline. Check your connection, then use Refresh to retry.");
      return;
    }
    try {
      setError(null);
      const base = collection(db, "questions");
      const q =
        scope === "wall"
          ? query(base, where("status", "in", ["approved", "featured"]), orderBy("created_at", "desc"), limit(200))
          : query(base, orderBy("created_at", "desc"), limit(200));

      for (let attempt = 0; ; attempt += 1) {
        try {
          const snap = await withTimeout(getDocs(q), FETCH_TIMEOUT_MS, "Firestore connection timed out");
          const list = snap.docs.map((d) => toQuestion(d.id, d.data()));
          setRows(scope === "wall" ? sortWall(list) : list);
          setLastSync(new Date().toISOString());
          setError(null);
          return;
        } catch (e) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setError("You are offline. Check your connection, then use Refresh to retry.");
            return;
          }
          if (isRetryable(e) && attempt < RETRY_DELAYS_MS.length) {
            const waitMs = RETRY_DELAYS_MS[attempt];
            setError(`${parseFirestoreError(e)} Retrying(${attempt + 1}) in ${waitMs / 1000}s...`);
            if (import.meta.env.DEV) {
              console.debug(`[questions] fetch retry ${attempt + 1} after ${waitMs}ms`);
            }
            await delay(waitMs);
            continue;
          }
          setError(parseFirestoreError(e));
          return;
        }
      }
    } catch (e) {
      setError(parseFirestoreError(e));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRows();

    // Safety timeout aligned with the 12s one-shot so the spinner
    // never sticks if both getDocs and the snapshot hang.
    const safetyTimer = window.setTimeout(() => {
      setLoading(false);
    }, FETCH_TIMEOUT_MS + 1000);

    if (!isFirebaseConfigured || !db) {
      window.clearTimeout(safetyTimer);
      return;
    }

    // Live updates come from onSnapshot only. The old 5s interval poll
    // is removed to dedupe traffic against the snapshot; manual Refresh
    // (fetchRows) remains for explicit retries.
    const base = collection(db, "questions");
    const liveQuery =
      scope === "wall"
        ? query(base, where("status", "in", ["approved", "featured"]), orderBy("created_at", "desc"), limit(200))
        : query(base, orderBy("created_at", "desc"), limit(200));

    const unsub = onSnapshot(
      liveQuery,
      (snap) => {
        window.clearTimeout(safetyTimer);
        const list = snap.docs.map((d) => toQuestion(d.id, d.data()));
        setRows(scope === "wall" ? sortWall(list) : list);
        setLastSync(new Date().toISOString());
        setLoading(false);
        setError(null);
      },
      (err) => {
        window.clearTimeout(safetyTimer);
        setError(parseFirestoreError(err));
        setLoading(false);
      },
    );

    return () => {
      window.clearTimeout(safetyTimer);
      unsub();
    };
  }, [fetchRows, scope]);

  const submit = useCallback(
    async (rawBody: string): Promise<string> => {
      const err = validateBody(rawBody);
      if (err) throw new Error(err);
      const body = maskPII(rawBody);
      const display_handle = generateHandle();

      if (!isFirebaseConfigured || !db) throw new Error(LIVE_CONFIG_ERROR);

      const addPromise = addDoc(collection(db, "questions"), {
        body,
        display_handle,
        status: "pending",
        upvote_count: 0,
        created_at: serverTimestamp(),
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Posting timed out. Please check your network or Firestore setup.")), 5000)
      );

      try {
        await Promise.race([addPromise, timeoutPromise]);
      } catch (submitErr) {
        throw new Error(parseFirestoreError(submitErr));
      }

      void fetchRows();
      return display_handle;
    },
    [fetchRows],
  );

  const upvote = useCallback(
    async (id: string): Promise<void> => {
      if (getVotedIds().has(id)) throw new Error("You already upvoted this question on this device.");

      if (!isFirebaseConfigured || !db) throw new Error(LIVE_CONFIG_ERROR);

      const firestore = db;
      const voterHash = getOrCreateVoterHash();
      const questionRef = doc(firestore, "questions", id);
      const voteRef = doc(firestore, "questions", id, "votes", voterHash);

      // Dedup is triple-guarded: localStorage set + vote doc-ID existence
      // check + rules !exists() guard. Count moves exactly +1 via increment.
      const existing = await getDoc(voteRef);
      if (existing.exists()) {
        markVoted(id);
        setVoted(getVotedIds());
        throw new Error("You already upvoted this question on this device.");
      }

      try {
        await runTransaction(firestore, async (tx) => {
          const qSnap = await tx.get(questionRef);
          if (!qSnap.exists()) throw new Error("That question is gone.");
          const qData = qSnap.data();
          if (qData.status !== "approved" && qData.status !== "featured") {
            throw new Error("This question is not live yet.");
          }
          const vSnap = await tx.get(voteRef);
          if (vSnap.exists()) throw new Error("You already upvoted this question on this device.");
          tx.set(voteRef, { created_at: serverTimestamp() });
          tx.update(questionRef, { upvote_count: increment(1) });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upvote failed.";
        if (msg.toLowerCase().includes("already upvoted")) {
          markVoted(id);
          setVoted(getVotedIds());
        }
        throw e instanceof Error ? e : new Error(msg);
      }
      markVoted(id);
      setVoted(getVotedIds());
      await fetchRows();
    },
    [fetchRows],
  );

  const setStatus = useCallback(
    async (id: string, status: QuestionStatus): Promise<void> => {
      if (!isFirebaseConfigured || !db) throw new Error(LIVE_CONFIG_ERROR);
      // Admin-only. Rules reject non-admin writes.
      await updateDoc(doc(db, "questions", id), { status });
      await fetchRows();
    },
    [fetchRows],
  );

  const value = useMemo(
    () => ({ rows, loading, error, voted, lastSync, refresh: fetchRows, submit, upvote, setStatus }),
    [rows, loading, error, voted, lastSync, fetchRows, submit, upvote, setStatus],
  );
  return value;
}
