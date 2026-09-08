import QuestionForm from "../components/QuestionForm";
import { useQuestions } from "../hooks/useQuestions";
import { isFirebaseConfigured } from "../lib/firebase";

export default function Ask() {
  const { submit } = useQuestions("wall");

  return (
    <div className="grid">
      <div>
        <p className="eyebrow">QR · Anonymous · 2-280 chars</p>
        <h1>Ask it live. No name needed.</h1>
        <p className="lede">
          Your question goes to moderation first. Approved questions appear on the projector wall at{" "}
          <a href="/wall">/wall</a>. One upvote per device keeps it fair.
        </p>
        <QuestionForm onSubmit={submit} />
        {!isFirebaseConfigured && (
          <div className="notice amber" role="status">
            Demo mode: Firebase env is missing. Posts are stored in this browser only. Add{" "}
            <code>VITE_FIREBASE_API_KEY</code> + <code>VITE_FIREBASE_PROJECT_ID</code> to go live.
          </div>
        )}
      </div>
      <div className="panel" aria-label="How it works">
        <h2>How it works</h2>
        <p className="lede">Post → pending → admin approves → wall shows featured first, then votes.</p>
        <div className="toolbar">
          <a className="btn ghost" href="/wall">
            View live wall
          </a>
        </div>
        <p className="meta">Tip: keep it short for the projector. 24px minimum wall text.</p>
      </div>
    </div>
  );
}
