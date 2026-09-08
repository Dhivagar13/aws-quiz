import { useState } from "react";
import QuestionCard from "../components/QuestionCard";
import { useQuestions } from "../hooks/useQuestions";
import { POLL_INTERVAL_MS } from "../lib/firebase";

export default function Wall() {
  const { rows, loading, error, voted, lastSync, refresh, upvote } = useQuestions("wall");
  const [voteError, setVoteError] = useState<string | null>(null);

  const featured = rows.filter((q) => q.status === "featured");
  const rest = rows.filter((q) => q.status !== "featured");

  async function handleUpvote(id: string): Promise<void> {
    setVoteError(null);
    try {
      await upvote(id);
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Upvote failed.");
    }
  }

  return (
    <div>
      <div className="wall-head">
        <div>
          <p className="eyebrow">Projector wall · auto-refresh {Math.round(POLL_INTERVAL_MS / 1000)}s</p>
          <h1>Live questions</h1>
        </div>
        <span className="wall-live" aria-live="polite">
          ● LIVE {rows.length}
        </span>
        <span className="meta">{lastSync ? `synced ${new Date(lastSync).toLocaleTimeString()}` : ""}</span>
        <span className="toolbar" style={{ marginLeft: "auto" }}>
          <button className="btn ghost small" type="button" onClick={() => void refresh()}>
            Refresh now
          </button>
        </span>
      </div>

      {loading && <div className="notice">Loading wall...</div>}
      {error && (
        <div className="notice amber" role="alert">
          {error}
        </div>
      )}
      {voteError && (
        <p className="error" role="alert">
          {voteError}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <div className="panel">
          <h2>No approved questions yet</h2>
          <p className="lede">
            Scan the QR to ask at <a href="/">/</a>. Pending posts appear here after moderation.
          </p>
        </div>
      )}

      {featured.length > 0 && (
        <section className="wall-featured grid" aria-label="Featured">
          {featured.map((q) => (
            <QuestionCard key={q.id} q={q} voted={voted.has(q.id)} onUpvote={(id) => void handleUpvote(id)} />
          ))}
        </section>
      )}

      <section className="wall-grid" aria-label="Approved" style={{ marginTop: 16 }}>
        {rest.map((q) => (
          <QuestionCard key={q.id} q={q} voted={voted.has(q.id)} onUpvote={(id) => void handleUpvote(id)} />
        ))}
      </section>
    </div>
  );
}
