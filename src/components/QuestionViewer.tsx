import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X, ThumbsUp, Pin, Clock, UserCheck } from "lucide-react";
import type { Question } from "../hooks/useQuestions";
import { timeAgo } from "../lib/format";

interface Props {
  questions: Question[];
  index: number;
  votedIds: Set<string>;
  onUpvote: (id: string) => void;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

// Fullscreen projector viewer. Clamps at ends with disabled arrows.
// Parent keeps the Wall list mounted; this overlay only reads live rows.
export default function QuestionViewer({ questions, index, votedIds, onUpvote, onIndexChange, onClose }: Props) {
  const total = questions.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(0, index), total - 1);
  const q = questions[safeIndex];

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);

  const isFirst = safeIndex <= 0;
  const isLast = safeIndex >= total - 1;
  const voted = q ? votedIds.has(q.id) : false;

  function goPrev() {
    if (!isFirst) onIndexChange(safeIndex - 1);
  }

  function goNext() {
    if (!isLast) onIndexChange(safeIndex + 1);
  }

  // Scroll lock + initial focus + return focus on close.
  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus close first so Tab order is close -> prev -> vote -> next.
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, []);

  // Keyboard: Escape closes, arrows move, Tab stays trapped.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, total, onClose, onIndexChange]);

  if (!q) return null;

  const isFeatured = q.status === "featured";

  return (
    <div className="viewer-backdrop" onClick={onClose} data-testid="question-viewer-backdrop">
      <div
        ref={panelRef}
        className={`viewer-panel glass ${isFeatured ? "featured" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qv-title"
        aria-describedby="qv-body"
        aria-label={`Question ${safeIndex + 1} of ${total} from ${q.display_handle}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const endX = e.changedTouches[0]?.clientX ?? touchX.current;
          const dx = endX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 48) return;
          if (dx > 0) goPrev();
          else goNext();
        }}
      >
        <div className="viewer-topbar">
          <div className="viewer-badges">
            {isFeatured && (
              <span className="badge badge-featured">
                <Pin size={13} aria-hidden="true" />
                <span>Pinned to top</span>
              </span>
            )}
            <span className="handle">
              <UserCheck size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
              {q.display_handle}
            </span>
            <span className="meta" title={new Date(q.created_at).toLocaleString()}>
              <Clock size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "-1px" }} />
              {timeAgo(q.created_at)}
            </span>
          </div>
          <div className="viewer-top-actions">
            <span className="viewer-counter" aria-live="polite" aria-atomic="true">
              {safeIndex + 1} of {total}
            </span>
            <button
              ref={closeRef}
              type="button"
              className="viewer-close"
              onClick={onClose}
              aria-label="Close fullscreen viewer (Escape)"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="viewer-nav viewer-prev"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous question"
          title={isFirst ? "First question" : "Previous question (Left arrow)"}
        >
          <ChevronLeft size={28} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="viewer-nav viewer-next"
          onClick={goNext}
          disabled={isLast}
          aria-label="Next question"
          title={isLast ? "Last question" : "Next question (Right arrow)"}
        >
          <ChevronRight size={28} aria-hidden="true" />
        </button>

        <h2 id="qv-title" className="viewer-sr-title">
          Question {safeIndex + 1} of {total} from {q.display_handle}
        </h2>
        <p id="qv-body" className="viewer-body">
          {q.body}
        </p>

        <div className="viewer-foot">
          <button
            type="button"
            className={`vote-btn ${voted ? "voted" : ""}`}
            aria-pressed={voted}
            aria-label={voted ? `Upvoted (${q.upvote_count})` : `Upvote ${q.display_handle}'s question`}
            onClick={() => {
              if (!voted) onUpvote(q.id);
            }}
          >
            <ThumbsUp size={18} className={voted ? "fill-current" : ""} />
            <span className="vote-counter">{q.upvote_count}</span>
            <span className="vote-text">{voted ? "Upvoted" : "Upvote"}</span>
          </button>
          <span className="viewer-hint" aria-hidden="true">
            Arrow keys or swipe to move · Esc to close
          </span>
        </div>
      </div>
    </div>
  );
}
