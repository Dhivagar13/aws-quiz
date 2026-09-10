import { useState } from "react";
import type { FormEvent } from "react";
import confetti from "canvas-confetti";
import { Send, Eye, Sparkles, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { MAX_LEN, MIN_LEN, validateBody } from "../lib/mask";
import { checkPostRate, recordPost } from "../lib/rateLimit";

interface Props {
  onSubmit: (body: string) => Promise<string>;
}

const INSPIRATIONS = [
  { label: "Certifications", prompt: "What is the best study roadmap for AWS Cloud Practitioner or Solutions Architect Associate?" },
  { label: "Free Tier", prompt: "How do I avoid unexpected charges and stay completely within the AWS Free Tier limit?" },
  { label: "Serverless", prompt: "When should we choose AWS Lambda vs running a container on ECS or EC2?" },
  { label: "Generative AI", prompt: "How can students get started building with Amazon Bedrock and foundation models?" },
  { label: "Cloud Careers", prompt: "Which AWS skills and portfolio projects do cloud recruiters look for in fresh graduates?" },
  { label: "IAM Security", prompt: "What are the most critical AWS security best practices for beginners building APIs?" },
];

export default function QuestionForm({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const trimmedLen = body.trim().length;
  const remaining = MAX_LEN - trimmedLen;
  const charPercentage = Math.min(100, Math.round((trimmedLen / MAX_LEN) * 100));

  function handleInsertInspiration(prompt: string) {
    // Choice: append with newline to preserve typed text; overwrite only when empty. Clear error stays.
    setBody((prev) => (prev.trim() ? `${prev}\n${prompt}`.slice(0, MAX_LEN) : prompt));
    setError(null);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setHandle(null);

    const validation = validateBody(body);
    if (validation) {
      setError(validation);
      return;
    }
    const rate = checkPostRate();
    if (!rate.allowed) {
      setError(`Slow down. Try again in ${rate.retryAfterSec}s. Max 10 posts per 5 minutes.`);
      return;
    }

    setBusy(true);
    try {
      const h = await onSubmit(body);
      recordPost();
      setHandle(h);
      setBody("");
      setShowPreview(false);

      // Trigger celebration confetti
      try {
        void confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.7 },
          colors: ["#ff9900", "#3dff88", "#2dd4bf", "#ffffff"],
          disableForReducedMotion: true,
        });
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-container">
      {/* Topic Inspiration Chips */}
      <div className="inspirations-wrapper" aria-label="Topic inspirations">
        <span className="inspirations-label">
          <Sparkles size={14} className="icon-amber" />
          <span>Try a topic:</span>
        </span>
        <div className="chips-scroll">
          {INSPIRATIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              className="chip-btn"
              onClick={() => handleInsertInspiration(item.prompt)}
              title="Click to use this question prompt"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <form className="panel glass glass-form" onSubmit={handleSubmit} aria-label="Ask anonymously">
        <div className="field">
          <div className="field-header">
            <label htmlFor="q-body" className="form-label">
              Your Question
            </label>
            <button
              type="button"
              className="preview-toggle-btn"
              onClick={() => setShowPreview(!showPreview)}
              aria-label="Toggle wall preview"
            >
              <Eye size={14} />
              <span>{showPreview ? "Hide Preview" : "Wall Preview"}</span>
            </button>
          </div>

          <div className="textarea-wrapper">
            <textarea
              id="q-body"
              className="glass-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_LEN}
              placeholder="Ask anything about AWS architecture, career roadmap, certifications, free tier..."
              rows={4}
              aria-describedby="q-count"
              autoCapitalize="sentences"
            />

            {/* Character meter indicator */}
            <div className="char-meter">
              <div className="char-progress-track">
                <div
                  className={`char-progress-bar ${
                    remaining < 30 ? "critical" : remaining < 80 ? "warning" : "good"
                  }`}
                  style={{ width: `${charPercentage}%` }}
                />
              </div>
              <span id="q-count" className="counter">
                {trimmedLen}/{MAX_LEN} chars · {remaining} left
              </span>
            </div>
          </div>
        </div>

        {/* Live Projector Wall Card Preview */}
        {showPreview && (
          <div className="preview-container enter">
            <div className="preview-label">
              <span>Preview on Wall</span>
              <span className="badge-preview">Sample Projection</span>
            </div>
            <div className="card glass-card preview-card">
              <div className="card-top">
                <span className="handle">anon-YOU</span>
                <span className="meta">just now</span>
              </div>
              <div className="card-body">
                {body.trim() || <span className="placeholder-text">Type your question above to see it appear here...</span>}
              </div>
              <div className="card-foot">
                <div className="vote-btn" style={{ pointerEvents: "none", opacity: 0.8 }}>
                  <span>▲ 0 Upvotes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="notice notice-error enter" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {handle && (
          <div className="notice notice-success enter" role="status">
            <CheckCircle2 size={20} className="text-phosphor" />
            <div>
              <strong>Question posted successfully!</strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "var(--muted)" }}>
                Assigned handle: <span className="handle-highlight">{handle}</span>. It is pending moderation and will appear on the wall once approved.
              </p>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            className="btn btn-cta submit-btn"
            type="submit"
            disabled={busy || trimmedLen < MIN_LEN}
          >
            {busy ? (
              <>
                <RefreshCw size={18} className="spinner" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Post Anonymously</span>
              </>
            )}
          </button>
        </div>

        <p className="form-footnote">
          Zero tracking · No sign-in required · Personal info (emails/phones) automatically scrubbed.
        </p>
      </form>
    </div>
  );
}
