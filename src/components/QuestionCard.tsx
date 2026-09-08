import type { Question } from "../hooks/useQuestions";

interface Props {
  q: Question;
  voted: boolean;
  onUpvote: (id: string) => void;
  compact?: boolean;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

export default function QuestionCard({ q, voted, onUpvote, compact }: Props) {
  return (
    <article className={q.status === "featured" ? "card featured" : "card"} aria-label={`Question from ${q.display_handle}`}>
      <div className="card-top">
        {q.status === "featured" && <span className="badge">Featured</span>}
        <span className="handle">{q.display_handle}</span>
        <span className="meta">{timeAgo(q.created_at)}</span>
        {!compact && <span className="meta">{q.upvote_count} votes</span>}
      </div>
      <div className="card-body">{q.body}</div>
      <div className="card-foot">
        <button
          type="button"
          className="vote"
          aria-pressed={voted}
          aria-label={voted ? "Upvoted" : `Upvote ${q.display_handle} question`}
          onClick={() => onUpvote(q.id)}
        >
          <span aria-hidden="true">{voted ? "▲" : "△"}</span>
          <span>{q.upvote_count}</span>
          <span>{voted ? "Voted" : "Upvote"}</span>
        </button>
      </div>
    </article>
  );
}
