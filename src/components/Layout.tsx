import { NavLink, Outlet } from "react-router-dom";
import mecLogo from "../assets/mec-logo.jpg";

export default function Layout() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="SBG MEC Q and A home">
            <img src={mecLogo} alt="Mailam Engineering College banner" />
            <span className="brand-lockup">
              <strong>AWS SBG · MEC Live Q&amp;A</strong>
              <span>Anonymous · Moderated · Projector wall</span>
            </span>
          </a>
          {/* AWS logo quarantined: src/assets/aws-logo.jpeg is a GitHub identicon, not official branding.
              Use text lockup instead to avoid trademark misuse. */}
          <span className="aws-lockup" aria-label="AWS Student Builder Group">
            AWS SBG
          </span>
          <nav className="nav" aria-label="Primary">
            <NavLink to="/">Ask</NavLink>
            <NavLink to="/wall">Wall</NavLink>
          </nav>
        </div>
      </header>

      <main className="shell">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Anonymous posting · one upvote per device · 5s refresh fallback for college WiFi.</span>
          <span>No answers are stored or shown in this MVP.</span>
        </div>
      </footer>
    </>
  );
}
