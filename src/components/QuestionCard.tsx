import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import confetti from "canvas-confetti";
import { ThumbsUp, Pin, Copy, Check, Clock, UserCheck, Maximize2 } from "lucide-react";
import type { Question } from "../hooks/useQuestions";
import { timeAgo } from "../lib/format";

interface Props {
  q: Question;
  voted: boolean;
  onUpvote: (id: string) => void;
  compact?: boolean;
  index?: number;
  onOpen?: () => void;
}

// Automatically detect prominent cloud topics from question text
function detectTopic(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("cert") || lower.includes("exam") || lower.includes("clf") || lower.includes("saa")) {
    return "Certification";
  }
  if (lower.includes("cost") || lower.includes("free tier") || lower.includes("bill") || lower.includes("price")) {
    return "Cost & Billing";
  }
  if (lower.includes("lambda") || lower.includes("serverless") || lower.includes("dynamo")) {
    return "Serverless";
  }
  if (lower.includes("ec2") || lower.includes("s3") || lower.includes("vpc") || lower.includes("rds")) {
    return "Core Cloud";
  }
  if (lower.includes("ai") || lower.includes("bedrock") || lower.includes("llm") || lower.includes("genai") || lower.includes("ml")) {
    return "Generative AI";
  }
  if (lower.includes("job") || lower.includes("career") || lower.includes("intern") || lower.includes("salary") || lower.includes("placement")) {
    return "Careers & Placement";
  }
  if (lower.includes("security") || lower.includes("iam") || lower.includes("auth") || lower.includes("safe")) {
    return "Security & IAM";
  }
  return null;
}

export default function QuestionCard({ q, voted, onUpvote, compact, index = 0, onOpen }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isBumping, setIsBumping] = useState(false);

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
    el.style.transform = `translateY(-4px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
  }

  function handleLeave(): void {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  async function handleCopy(e: MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`"${q.body}" — ${q.display_handle} (AWS MEC Q&A)`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleVoteClick(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (voted) return;

    // Gentle tactile haptic feedback for mobile
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.([15]);
      } catch {
        // ignore
      }
    }

    // Micro particle celebration from vote button
    const btnRect = e.currentTarget.getBoundingClientRect();
    const x = (btnRect.left + btnRect.width / 2) / window.innerWidth;
    const y = (btnRect.top + btnRect.height / 2) / window.innerHeight;

    try {
      void confetti({
        particleCount: 18,
        spread: 45,
        startVelocity: 16,
        origin: { x, y },
        colors: ["#3dff88", "#ff9900", "#ffffff", "#2dd4bf"],
        disableForReducedMotion: true,
      });
    } catch {
      // ignore
    }

    setIsBumping(true);
    setTimeout(() => setIsBumping(false), 400);
    onUpvote(q.id);
  }

  const topic = detectTopic(q.body);
  const stagger = Math.min(Math.max(0, index), 8) * 50;
  const isFeatured = q.status === "featured";
  const cls = isFeatured
    ? `card glass-card tilt enter featured ${compact ? "compact" : ""} ${onOpen ? "openable" : ""}`
    : `card glass-card tilt enter ${compact ? "compact" : ""} ${onOpen ? "openable" : ""}`;

  function handleCardActivate(e: MouseEvent<HTMLElement>) {
    if (!onOpen) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("button, a, input, textarea, select")) return;
    onOpen();
  }

  return (
    <article
      ref={ref}
      className={cls}
      style={{ "--d": `${stagger}ms` } as CSSProperties}
      aria-label={`${isFeatured ? "Pinned spotlight question" : "Question"} from ${q.display_handle}`}
      data-featured={isFeatured || undefined}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleCardActivate}
    >
      <div className="card-top">
        <div className="card-top-badges">
          {isFeatured && (
            <span className="badge badge-featured" title="Pinned to top of Wall">
              <Pin size={13} className="badge-icon-spin" aria-hidden="true" />
              <span>Pinned to top</span>
            </span>
          )}
          {topic && <span className="badge badge-topic">{topic}</span>}
        </div>

        <div className="card-top-meta">
          <span className="handle" title="Anonymous Attendee ID">
            <UserCheck size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
            {q.display_handle}
          </span>
          <span className="meta" title={new Date(q.created_at).toLocaleString()}>
            <Clock size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "-1px" }} />
            {timeAgo(q.created_at)}
          </span>
        </div>
      </div>

      {onOpen ? (
        <button
          type="button"
          className="card-open-btn"
          onClick={onOpen}
          aria-label={`Open fullscreen view of question from ${q.display_handle}`}
        >
          {q.body}
        </button>
      ) : (
        <div className="card-body">{q.body}</div>
      )}

      <div className="card-foot">
        <button
          type="button"
          className={`vote-btn ${voted ? "voted" : ""} ${isBumping ? "bump" : ""}`}
          aria-pressed={voted}
          aria-label={voted ? `Upvoted (${q.upvote_count})` : `Upvote ${q.display_handle}'s question`}
          onClick={handleVoteClick}
        >
          <ThumbsUp size={16} className={voted ? "fill-current" : ""} />
          <span className="vote-counter">{q.upvote_count}</span>
          <span className="vote-text">{voted ? "Upvoted" : "Upvote"}</span>
        </button>

        <div className="card-actions">
          {onOpen && (
            <button
              type="button"
              className="icon-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              title="Open fullscreen viewer"
              aria-label={`Expand question from ${q.display_handle} to fullscreen`}
            >
              <Maximize2 size={14} />
              <span className="action-hint">Expand</span>
            </button>
          )}
          <button
            type="button"
            className="icon-action-btn"
            onClick={handleCopy}
            title="Copy question text"
            aria-label="Copy question"
          >
            {copied ? <Check size={14} className="text-phosphor" /> : <Copy size={14} />}
            <span className="action-hint">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
