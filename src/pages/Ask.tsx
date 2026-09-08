import { Link, useOutletContext } from "react-router-dom";
import QuestionForm from "../components/QuestionForm";
import { useQuestions } from "../hooks/useQuestions";
import { isFirebaseConfigured } from "../lib/firebase";
import { ShieldCheck, Layers, QrCode, Sparkles, Check, ChevronRight, HelpCircle } from "lucide-react";

interface ContextType {
  openQrModal: () => void;
}

export default function Ask() {
  const { submit } = useQuestions("wall");
  const { openQrModal } = useOutletContext<ContextType>();

  return (
    <div className="ask-layout">
      <div className="ask-main">
        <div className="ask-header-compact">
          <div className="ask-header-badge-row">
            <span className="pill-badge pill-aws">
              <Sparkles size={12} />
              <span>Live Auditorium Session</span>
            </span>
            <span className="pill-badge pill-mec">
              <span>MEC × AWS SBG</span>
            </span>
          </div>

          <h1 className="ask-compact-title">
            Ask It Live <span className="gradient-text">· 100% Anonymous</span>
          </h1>
          <p className="ask-compact-sub">
            Post directly from your seat. Approved questions stream to the auditorium projector wall.
          </p>
        </div>

        <QuestionForm onSubmit={submit} />

        {!isFirebaseConfigured && (
          <div className="notice amber enter" role="alert">
            Live setup required: Firebase env is missing. Add <code>VITE_FIREBASE_API_KEY</code>,{" "}
            <code>VITE_FIREBASE_AUTH_DOMAIN</code>, <code>VITE_FIREBASE_PROJECT_ID</code>, and{" "}
            <code>VITE_FIREBASE_APP_ID</code> to <code>.env</code> and restart. Zero questions shown
            until configured.
          </div>
        )}
      </div>

      <aside className="ask-sidebar">
        {/* How It Works Glass Card */}
        <div className="panel glass info-panel">
          <div className="info-panel-header">
            <div className="info-icon-badge">
              <ShieldCheck size={20} className="text-phosphor" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem" }}>How It Works</h2>
              <span className="info-sub">Fair, moderated, real-time</span>
            </div>
          </div>

          <div className="steps-list">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Ask from your phone</strong>
                <p>Type your question. Personal data like phone numbers or emails are automatically scrubbed.</p>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Moderator verifies</strong>
                <p>Submissions enter a quick review queue to keep discussions productive and focused.</p>
              </div>
            </div>

            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Projector &amp; Upvoting</strong>
                <p>Questions appear on the auditorium screen. Everyone gets 1 vote per device to bump top topics.</p>
              </div>
            </div>
          </div>

          <div className="sidebar-buttons">
            <Link to="/wall" className="btn btn-outline" style={{ width: "100%", textDecoration: "none" }}>
              <Layers size={16} />
              <span>Open Projector Wall</span>
              <ChevronRight size={14} style={{ marginLeft: "auto" }} />
            </Link>

            <button
              type="button"
              className="btn ghost small"
              onClick={openQrModal}
              style={{ width: "100%" }}
            >
              <QrCode size={16} />
              <span>Share QR Code</span>
            </button>
          </div>
        </div>

        {/* Audience Tips Glass Card */}
        <div className="panel glass-subtle tips-card">
          <div className="tips-header">
            <HelpCircle size={16} className="text-amber" />
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Event Guidelines</span>
          </div>
          <ul className="tips-list">
            <li>
              <Check size={14} className="text-phosphor" />
              <span>Keep questions clear and concise (under 280 chars) for readability on the projector.</span>
            </li>
            <li>
              <Check size={14} className="text-phosphor" />
              <span>Check the Wall first to upvote existing questions before asking duplicates.</span>
            </li>
            <li>
              <Check size={14} className="text-phosphor" />
              <span>Featured questions with high community votes get answered first by speakers!</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
