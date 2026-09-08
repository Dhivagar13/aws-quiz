import { useState } from "react";
import type { FormEvent } from "react";
import { MAX_LEN, validateBody } from "../lib/mask";
import { checkPostRate, recordPost } from "../lib/rateLimit";

interface Props {
  onSubmit: (body: string) => Promise<string>;
}

export default function QuestionForm({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);

  const remaining = MAX_LEN - body.length;

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
      setError(`Slow down. Try again in ${rate.retryAfterSec}s. Max 3 posts per minute.`);
      return;
    }

    setBusy(true);
    try {
      const h = await onSubmit(body);
      recordPost();
      setHandle(h);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel glass" onSubmit={handleSubmit} aria-label="Ask anonymously">
      <div className="field">
        <label htmlFor="q-body">Your question</label>
        <textarea
          id="q-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_LEN}
          placeholder="Ask about SBG, costs, scaling, careers..."
          rows={5}
          aria-describedby="q-count"
        />
        <span id="q-count" className="counter">
          {body.trim().length}/{MAX_LEN} · {remaining} left · no names, emails, or phones
        </span>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {handle && (
        <div className="notice" role="status">
          Posted as <strong>{handle}</strong>. It is pending moderation and will appear on the wall once
          approved.
        </div>
      )}

      <button className="btn btn-cta" type="submit" disabled={busy || body.trim().length < 2}>
        {busy ? "Posting..." : "Post anonymously"}
      </button>
    </form>
  );
}
