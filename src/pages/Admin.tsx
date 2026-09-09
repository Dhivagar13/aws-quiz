import { useEffect, useState, useMemo } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { Auth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseApp, isFirebaseConfigured, loadAdminAuth } from "../lib/firebase";
import { useQuestions, type QuestionStatus, type Question } from "../hooks/useQuestions";
import { timeAgo } from "../lib/format";
import {
  ShieldAlert,
  CheckCircle,
  Sparkles,
  XCircle,
  RefreshCw,
  LogOut,
  LogIn,
  Search,
  Lock,
  Mail,
  Clock,
  Eye,
  EyeOff,
  ThumbsUp,
  RotateCcw,
} from "lucide-react";

type AdminTab = "pending" | "live" | "rejected" | "all";

const AUTH_TIMEOUT_MS = 12000;

function withAuthTimeout<T>(promise: Promise<T>, message = "Sign-in timed out after 12s. Check your connection, then try again."): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function mapAuthError(e: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You are offline. Check your connection, then try again.";
  }
  if (!(e instanceof Error)) return "Sign-in failed. Try again.";
  const combined = `${(e as { code?: unknown }).code ?? ""} ${e.message}`.toLowerCase();
  if (combined.includes("timed out") || combined.includes("timeout")) {
    return "Sign-in timed out after 12s. Check your connection, then try again.";
  }
  if (
    combined.includes("network-request-failed") ||
    combined.includes("network") ||
    combined.includes("failed to fetch") ||
    combined.includes("unavailable")
  ) {
    return "Network error during sign-in. Check your connection, then try again.";
  }
  if (combined.includes("too-many-requests") || combined.includes("too many requests")) {
    return "Too many attempts. Wait a moment, then try again.";
  }
  if (combined.includes("operation-not-allowed") || combined.includes("operation not allowed")) {
    return "Email sign-in is disabled for this project. Enable Email/Password in Firebase Console.";
  }
  if (
    combined.includes("invalid-credential") ||
    combined.includes("invalid credential") ||
    combined.includes("user-not-found") ||
    combined.includes("user not found") ||
    combined.includes("wrong-password") ||
    combined.includes("wrong password") ||
    combined.includes("invalid-email") ||
    combined.includes("invalid email")
  ) {
    return "Wrong email or password. Try again.";
  }
  return e.message;
}

export default function Admin() {
  // Auth gate only. The admin Firestore list lives in <AdminDeck/>, which
  // mounts only when isAdmin is true, so anon never triggers the admin
  // query (and its permission-denied noise) while !isAdmin.
  const [isAdmin, setIsAdmin] = useState(false);
  const [authInstance, setAuthInstance] = useState<Auth | null>(null);
  const [authChecking, setAuthChecking] = useState(() => Boolean(isFirebaseConfigured && firebaseApp && db));
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isCredentialError = authError === "Wrong email or password. Try again.";

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !firebaseApp) {
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        // Lazy-load firebase/auth only on /admin so / and /wall never
        // trigger Identity Toolkit getProjectConfig or fetch iframe.js.
        const auth = await loadAdminAuth();
        if (cancelled) return;
        setAuthInstance(auth);
        const { getIdTokenResult, onAuthStateChanged } = await import("firebase/auth");
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, (user) => {
          void (async () => {
            if (!user || !db) {
              setIsAdmin(false);
              setUserEmail(null);
              setAuthChecking(false);
              return;
            }
            try {
              // Admin if custom claim is_admin == true OR admins/{uid} doc exists.
              const token = await withAuthTimeout(
                getIdTokenResult(user, true).catch(() => getIdTokenResult(user)),
                "Checking admin status timed out. Try signing in again.",
              );
              const claimAdmin = (token.claims as Record<string, unknown>).is_admin === true;
              if (claimAdmin) {
                setIsAdmin(true);
              } else {
                const snap = await withAuthTimeout(
                  getDoc(doc(db, "admins", user.uid)),
                  "Checking admin status timed out. Try signing in again.",
                );
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
      } catch {
        if (!cancelled) setAuthChecking(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  async function doSignIn(): Promise<void> {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const auth = authInstance ?? (await withAuthTimeout(loadAdminAuth()));
      if (!authInstance) setAuthInstance(auth);
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await withAuthTimeout(signInWithEmailAndPassword(auth, email.trim(), password));
      setPassword("");
    } catch (err) {
      setAuthError(mapAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    await doSignIn();
  }

  async function handleSignOut(): Promise<void> {
    if (authInstance) {
      const { signOut } = await import("firebase/auth");
      await signOut(authInstance);
    }
    setIsAdmin(false);
    setUserEmail(null);
  }

  if (authChecking) {
    return (
      <div className="grid">
        <div className="panel glass enter" style={{ textAlign: "center", padding: "48px 24px" }}>
          <RefreshCw size={24} className="spinner icon-amber" style={{ margin: "0 auto 12px" }} />
          <p>Verifying moderator credentials...</p>
        </div>
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="grid">
        <div className="panel glass">
          <p className="eyebrow">Hidden · /admin</p>
          <h1>Live Setup Required</h1>
          <p className="lede">
            Firebase env is missing. Add <code>VITE_FIREBASE_API_KEY</code>,{" "}
            <code>VITE_FIREBASE_AUTH_DOMAIN</code>, <code>VITE_FIREBASE_PROJECT_ID</code>, and{" "}
            <code>VITE_FIREBASE_APP_ID</code> to <code>.env</code> and restart.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-login-wrapper enter">
        <div className="panel glass login-card">
          <div className="login-icon-badge">
            <ShieldAlert size={32} className="text-amber" />
          </div>
          <p className="eyebrow">Moderator Console</p>
          <h2>Sign In to Moderate</h2>
          <p className="lede" style={{ fontSize: "0.95rem" }}>
            Single-operator sign-in for stage moderators. Event owner authorizes your UID in the admins collection.
          </p>

          <form onSubmit={handleSignIn} className="login-form">
            <style>{`.password-toggle:focus-visible{outline:2px solid var(--amber,#f59e0b);outline-offset:2px;border-radius:8px;}`}</style>
            <div className="field">
              <label htmlFor="a-email">Admin Email</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="a-email"
                  type="email"
                  className="glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="moderator@mec.edu"
                  aria-invalid={isCredentialError || undefined}
                  aria-describedby={authError ? "admin-auth-error" : undefined}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="a-pass">Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  id="a-pass"
                  type={showPassword ? "text" : "password"}
                  className="glass-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  aria-invalid={isCredentialError || undefined}
                  aria-describedby={authError ? "admin-auth-error" : undefined}
                  style={{ paddingRight: "52px" }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: "4px",
                    width: "44px",
                    height: "44px",
                    display: "grid",
                    placeItems: "center",
                    background: "transparent",
                    border: "0",
                    cursor: "pointer",
                    color: "inherit",
                    borderRadius: "8px",
                  }}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {authError && (
              <div id="admin-auth-error" className="notice notice-error" role="alert">
                <span>{authError}</span>
                <button
                  className="btn ghost small"
                  type="button"
                  disabled={authBusy}
                  onClick={() => void doSignIn()}
                  style={{ marginTop: "12px" }}
                >
                  <RefreshCw size={14} />
                  <span>Try again</span>
                </button>
              </div>
            )}

            <button className="btn btn-cta submit-btn" type="submit" disabled={authBusy}>
              {authBusy ? (
                <>
                  <RefreshCw size={16} className="spinner" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Enter Moderator Deck</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDeck userEmail={userEmail} onSignOut={handleSignOut} />;
}

function AdminDeck({
  userEmail,
  onSignOut,
}: {
  userEmail: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  // Mounted only when isAdmin is true, so the admin-scoped list query
  // (unfiltered orderBy) never runs for anon. Any error here is a real
  // admin error, never false deny noise from the pre-auth state.
  const { rows, loading, error, refresh, setStatus } = useQuestions("admin");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("pending");
  const [search, setSearch] = useState("");

  async function act(id: string, status: QuestionStatus): Promise<void> {
    setActionError(null);
    setActionSuccess(null);
    try {
      await setStatus(id, status);
      setActionSuccess(`Question updated to ${status}.`);
      setTimeout(() => setActionSuccess(null), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Moderation failed. Check rules / admin allowlist.");
    }
  }

  const pending = useMemo(() => rows.filter((q) => q.status === "pending"), [rows]);
  const live = useMemo(() => rows.filter((q) => q.status === "approved" || q.status === "featured"), [rows]);
  const featured = useMemo(() => rows.filter((q) => q.status === "featured"), [rows]);
  const rejected = useMemo(() => rows.filter((q) => q.status === "rejected"), [rows]);

  const displayedQuestions = useMemo(() => {
    let list: Question[] = [];
    if (activeTab === "pending") list = pending;
    else if (activeTab === "live") list = live;
    else if (activeTab === "rejected") list = rejected;
    else list = rows;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (item) => item.body.toLowerCase().includes(q) || item.display_handle.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, pending, live, rejected, rows, search]);

  return (
    <div className="admin-dashboard">
      {/* Admin Top Header */}
      <div className="admin-header">
        <div>
          <div className="wall-eyebrow">
            <span className="live-tag">
              <ShieldAlert size={12} />
              <span>MODERATOR DESK</span>
            </span>
            <span>Private stage controls</span>
          </div>
          <h1>Live Moderation Deck</h1>
        </div>

        <div className="admin-user-toolbar">
          <button className="btn ghost small" type="button" onClick={() => void refresh()}>
            <RefreshCw size={14} />
            <span>Sync</span>
          </button>
          <button className="btn danger small" type="button" onClick={() => void onSignOut()}>
            <LogOut size={14} />
            <span>Sign out ({userEmail})</span>
          </button>
        </div>
      </div>

      {/* Admin Stats Grid */}
      <div className="admin-stats-grid">
        <button
          type="button"
          className={`stat-card glass ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          <div className="stat-card-top">
            <span className="stat-card-title">Pending Review</span>
            <Clock size={16} className="text-amber" />
          </div>
          <span className={`stat-card-value ${pending.length > 0 ? "highlight-amber" : ""}`}>
            {pending.length}
          </span>
          <span className="stat-card-hint">
            {pending.length > 0 ? "Awaiting decision" : "Queue is clear"}
          </span>
        </button>

        <button
          type="button"
          className={`stat-card glass ${activeTab === "live" ? "active" : ""}`}
          onClick={() => setActiveTab("live")}
        >
          <div className="stat-card-top">
            <span className="stat-card-title">Live on Wall</span>
            <CheckCircle size={16} className="text-phosphor" />
          </div>
          <span className="stat-card-value">{live.length}</span>
          <span className="stat-card-hint">Visible to audience</span>
        </button>

        <button
          type="button"
          className="stat-card glass"
          onClick={() => setActiveTab("live")}
        >
          <div className="stat-card-top">
            <span className="stat-card-title">Featured Spotlight</span>
            <Sparkles size={16} className="text-gold" />
          </div>
          <span className="stat-card-value">{featured.length}</span>
          <span className="stat-card-hint">Top projector prominence</span>
        </button>

        <button
          type="button"
          className={`stat-card glass ${activeTab === "rejected" ? "active" : ""}`}
          onClick={() => setActiveTab("rejected")}
        >
          <div className="stat-card-top">
            <span className="stat-card-title">Rejected</span>
            <XCircle size={16} className="text-danger" />
          </div>
          <span className="stat-card-value">{rejected.length}</span>
          <span className="stat-card-hint">Hidden from audience</span>
        </button>
      </div>

      {/* Action Notices */}
      {error && (
        <div className="notice amber enter" role="alert">
          {error}
        </div>
      )}
      {actionError && (
        <div className="notice notice-error enter" role="alert">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="notice notice-success enter" role="status">
          {actionSuccess}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="admin-filter-bar glass">
        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending ({pending.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            Live ({live.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            Rejected ({rejected.length})
          </button>
          <button
            type="button"
            className={`filter-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({rows.length})
          </button>
        </div>

        <div className="search-box">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search questions in queue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Queue List */}
      <div className="admin-queue-list">
        {loading && (
          <div className="notice enter">
            <RefreshCw size={16} className="spinner" />
            <span>Updating moderation list...</span>
          </div>
        )}

        {!loading && displayedQuestions.length === 0 && (
          <div className="panel glass enter" style={{ textAlign: "center", padding: "40px" }}>
            <p className="lede" style={{ margin: 0 }}>
              {search ? "No questions match your search." : `No questions in ${activeTab} queue.`}
            </p>
          </div>
        )}

        {displayedQuestions.map((q, i) => (
          <div
            key={q.id}
            className={`admin-question-card glass-card enter ${q.status === "featured" ? "featured" : ""}`}
            style={{ "--d": `${Math.min(i, 8) * 40}ms` } as CSSProperties}
          >
            <div className="admin-card-header">
              <div className="admin-card-badges">
                <span className={`status-pill pill-${q.status}`}>{q.status}</span>
                <span className="handle">{q.display_handle}</span>
              </div>
              <div className="admin-card-meta">
                <span>
                  <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                  {timeAgo(q.created_at)}
                </span>
                <span>
                  <ThumbsUp size={12} style={{ display: "inline", marginRight: 4 }} />
                  {q.upvote_count} votes
                </span>
              </div>
            </div>

            <div className="admin-card-body">{q.body}</div>

            <div className="admin-actions-bar">
              {q.status !== "approved" && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => void act(q.id, "approved")}
                  title="Approve for live wall"
                >
                  <CheckCircle size={14} />
                  <span>Approve</span>
                </button>
              )}

              {q.status !== "featured" && (
                <button
                  type="button"
                  className="btn warn small"
                  onClick={() => void act(q.id, "featured")}
                  title="Pin to top featured section with gold spotlight"
                >
                  <Sparkles size={14} />
                  <span>Feature</span>
                </button>
              )}

              {q.status === "featured" && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void act(q.id, "approved")}
                  title="Demote to normal approved question"
                >
                  <RotateCcw size={14} />
                  <span>Unfeature</span>
                </button>
              )}

              {q.status !== "rejected" && (
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => void act(q.id, "rejected")}
                  title="Hide from audience"
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>
              )}

              {q.status === "rejected" && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void act(q.id, "pending")}
                  title="Return to pending review"
                >
                  <RotateCcw size={14} />
                  <span>Re-evaluate</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
