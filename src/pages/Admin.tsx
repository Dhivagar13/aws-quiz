import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import { useQuestions, type QuestionStatus } from "../hooks/useQuestions";

export default function Admin() {
  const { rows, loading, error, refresh, setStatus } = useQuestions("admin");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setIsAdmin(false);
      setUserEmail(null);
      setAuthChecking(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!user || !db) {
          setIsAdmin(false);
          setUserEmail(null);
          setAuthChecking(false);
          return;
        }
        try {
          // Admin if custom claim is_admin == true OR admins/{uid} doc exists.
          const token = await getIdTokenResult(user, true).catch(() => getIdTokenResult(user));
          const claimAdmin = (token.claims as Record<string, unknown>).is_admin === true;
          if (claimAdmin) {
            setIsAdmin(true);
          } else {
            const snap = await getDoc(doc(db, "admins", user.uid));
            setIsAdmin(snap.exists());
          }
          setUserEmail(user.email);
        } catch {
          setIsAdmin(false);
          setUserEmail(user.email);
        } finally {
          setAuthChecking(false);
        }
      })();
    });
    return () => unsub();
  }, []);

  async function handleSignIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!auth) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (auth) await signOut(auth);
    setIsAdmin(false);
    setUserEmail(null);
  }

  async function act(id: string, status: QuestionStatus): Promise<void> {
    setActionError(null);
    try {
      await setStatus(id, status);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Moderation failed. Check rules / admin allowlist.");
    }
  }

  const pending = rows.filter((q) => q.status === "pending");
  const live = rows.filter((q) => q.status === "approved" || q.status === "featured");
  const rejected = rows.filter((q) => q.status === "rejected");

  if (authChecking) {
    return (
      <div className="grid">
        <div className="notice">Checking moderator session...</div>
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="grid">
        <div className="panel">
          <p className="eyebrow">Hidden · /admin</p>
          <h1>Live setup required</h1>
          <p className="lede">
            Firebase env is missing. Add <code>VITE_FIREBASE_API_KEY</code>,{" "}
            <code>VITE_FIREBASE_AUTH_DOMAIN</code>, <code>VITE_FIREBASE_PROJECT_ID</code>, and{" "}
            <code>VITE_FIREBASE_APP_ID</code> to <code>.env</code> and restart. Zero questions shown
            until configured.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid">
        <div className="panel">
          <p className="eyebrow">Hidden · /admin</p>
          <h1>Moderator sign-in</h1>
          <p className="lede">
            Single admin via Firebase Auth + <code>is_admin</code> claim or <code>admins</code> allowlist.
            Ask the event owner to grant your UID, then sign in here. Firestore rules enforce everything
            server-side.
          </p>
          <form onSubmit={handleSignIn} className="grid">
            <div className="field">
              <label htmlFor="a-email">Admin email</label>
              <input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </div>
            <div className="field">
              <label htmlFor="a-pass">Password</label>
              <input id="a-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {authError && <p className="error" role="alert">{authError}</p>}
            <button className="btn" type="submit" disabled={authBusy}>{authBusy ? "Signing in..." : "Sign in"}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <div>
        <p className="eyebrow">Hidden · /admin · not linked in nav</p>
        <h1>Moderate</h1>
        <p className="lede">{pending.length} pending · {live.length} live · {rejected.length} rejected</p>
        <div className="toolbar">
          <button className="btn ghost small" type="button" onClick={() => void refresh()}>Refresh</button>
          {isFirebaseConfigured && (
            <button className="btn ghost small" type="button" onClick={() => void handleSignOut()}>Sign out{userEmail ? ` (${userEmail})` : ""}</button>
          )}
        </div>
        {loading && <div className="notice">Loading queue...</div>}
        {error && <div className="notice amber" role="alert">{error}</div>}
        {actionError && <p className="error" role="alert">{actionError}</p>}
      </div>

      <section aria-label="Pending queue" className="queue">
        <h2>Pending ({pending.length})</h2>
        {pending.length === 0 && <div className="panel"><p className="lede">Queue is clear.</p></div>}
        {pending.map((q, i) => (
          <div key={q.id} className="card glass-card enter" style={{ "--d": `${Math.min(i, 8) * 60}ms` } as CSSProperties}>
            <div className="card-top"><span className="handle">{q.display_handle}</span><span className="meta">{new Date(q.created_at).toLocaleString()}</span></div>
            <div className="card-body">{q.body}</div>
            <div className="admin-bar">
              <button className="btn small" type="button" onClick={() => void act(q.id, "approved")}>Approve</button>
              <button className="btn warn small" type="button" onClick={() => void act(q.id, "featured")}>Feature</button>
              <button className="btn danger small" type="button" onClick={() => void act(q.id, "rejected")}>Reject</button>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Live" className="queue live-grid">
        <h2 style={{ gridColumn: "1 / -1" }}>Live ({live.length})</h2>
        {live.map((q, i) => (
          <div key={q.id} className={q.status === "featured" ? "card glass-card enter featured" : "card glass-card enter"} style={{ "--d": `${Math.min(i, 8) * 60}ms` } as CSSProperties}>
            <div className="card-top">
              {q.status === "featured" && <span className="badge">Featured</span>}
              <span className="handle">{q.display_handle}</span>
              <span className="meta">{q.upvote_count} votes</span>
            </div>
            <div className="card-body">{q.body}</div>
            <div className="admin-bar">
              {q.status !== "featured" && <button className="btn warn small" type="button" onClick={() => void act(q.id, "featured")}>Feature</button>}
              {q.status === "featured" && <button className="btn ghost small" type="button" onClick={() => void act(q.id, "approved")}>Unfeature</button>}
              <button className="btn danger small" type="button" onClick={() => void act(q.id, "rejected")}>Remove</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
