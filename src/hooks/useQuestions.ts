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
import { POLL_INTERVAL_MS, db, isFirebaseConfigured } from "../lib/firebase";
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
    try {
      setError(null);
      const base = collection(db, "questions");
      // Wall filters server-side to approved/featured only. Featured-first
      // ordering stays client-side in sortWall so the projector order is
      // stable even when votes arrive out of order.
      // NOTE: where(status in [...]) + orderBy(created_at) needs the
      // composite index in firestore.indexes.json.
      const q =
        scope === "wall"
          ? query(base, where("status", "in", ["approved", "featured"]), orderBy("created_at", "desc"), limit(200))
          : query(base, orderBy("created_at", "desc"), limit(200));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => toQuestion(d.id, d.data()));
      setRows(scope === "wall" ? sortWall(list) : list);
      setLastSync(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    void fetchRows();

    // Polling is live resilience: college WiFi may block websockets even
    // with Firestore long-polling enabled. onSnapshot + 5s poll stay on.
    const timer = window.setInterval(() => {
      void fetchRows();
    }, POLL_INTERVAL_MS);

    if (!isFirebaseConfigured || !db) {
      return () => window.clearInterval(timer);
    }

    const base = collection(db, "questions");
    const liveQuery =
      scope === "wall"
        ? query(base, where("status", "in", ["approved", "featured"]), orderBy("created_at", "desc"), limit(200))
        : query(base, orderBy("created_at", "desc"), limit(200));

    const unsub = onSnapshot(
      liveQuery,
      (snap) => {
        const list = snap.docs.map((d) => toQuestion(d.id, d.data()));
        setRows(scope === "wall" ? sortWall(list) : list);
        setLastSync(new Date().toISOString());
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Live updates paused. Polling every 5s.");
        setLoading(false);
      },
    );

    return () => {
      window.clearInterval(timer);
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

      // Anonymous create is pending-only. Rules reject any other status,
      // out-of-range body, bad handle, or non-zero upvote_count.
      await addDoc(collection(db, "questions"), {
        body,
        display_handle,
        status: "pending",
        upvote_count: 0,
        created_at: serverTimestamp(),
      });
      await fetchRows();
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
