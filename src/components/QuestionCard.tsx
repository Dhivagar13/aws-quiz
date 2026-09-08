import { useRef } from "react";
import type { CSSProperties, MouseEvent } from "react";
import type { Question } from "../hooks/useQuestions";

interface Props {
  q: Question;
  voted: boolean;
  onUpvote: (id: string) => void;
  compact?: boolean;
  index?: number;
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

export default function QuestionCard({ q, voted, onUpvote, compact, index = 0 }: Props) {
  const ref = useRef<HTMLElement | null>(null);

  function canTilt(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return fine && !calm;
  }

  function handleMove(e: MouseEvent): void {
    const el = ref.current;
    if (!el || !canTilt()) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
    const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
    el.style.transform = `translateY(-4px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
  }

  function handleLeave(): void {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  const stagger = Math.min(Math.max(0, index), 8) * 60;
  const cls = q.status === "featured" ? "card glass-card tilt enter featured" : "card glass-card tilt enter";

  return (
    <article
      ref={ref}
      className={cls}
      style={{ "--d": `${stagger}ms` } as CSSProperties}
      aria-label={`Question from ${q.display_handle}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
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
