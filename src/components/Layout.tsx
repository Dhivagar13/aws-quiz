import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import mecLogo from "../assets/mec-logo.jpg";
import AmbientBackground from "./AmbientBackground";
import QRCodeModal from "./QRCodeModal";
import { MessageSquarePlus, Layers, QrCode, Cloud, Radio } from "lucide-react";

export default function Layout() {
  const [showQrModal, setShowQrModal] = useState(false);
  const location = useLocation();

  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function updatePillPosition() {
      if (!navRef.current || !pillRef.current) return;
      const activeBtn = navRef.current.querySelector<HTMLElement>(".liquid-nav-btn.active");
      if (!activeBtn) {
        pillRef.current.style.opacity = "0";
        return;
      }
      pillRef.current.style.opacity = "1";
      pillRef.current.style.width = `${activeBtn.offsetWidth}px`;
      pillRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }

    // Delay slightly to ensure layout widths are rendered
    const timer = setTimeout(updatePillPosition, 30);
    window.addEventListener("resize", updatePillPosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePillPosition);
    };
  }, [location.pathname]);

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    if (!navRef.current || !glareRef.current) return;
    const rect = navRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glareRef.current.style.setProperty("--x", `${x}px`);
    glareRef.current.style.setProperty("--y", `${y}px`);
  }

  return (
    <>
      <AmbientBackground />

      <header className="topbar glass">
        <div className="topbar-inner">
          <NavLink className="brand" to="/" aria-label="SBG MEC Q and A home">
            <img src={mecLogo} alt="Mailam Engineering College banner" />
            <span className="brand-lockup">
              <strong className="brand-title-desktop">AWS SBG · MEC Live Q&amp;A</strong>
              <strong className="brand-title-mobile">AWS SBG</strong>
              <span className="brand-sub">Anonymous · Moderated</span>
            </span>
          </NavLink>

          <div className="header-meta">
            <span className="aws-lockup" aria-label="AWS Student Builder Group">
              <Cloud size={14} className="aws-cloud-icon" />
              <span>AWS SBG</span>
            </span>

            <span className="live-pill" title="Live sync active">
              <Radio size={12} className="live-dot-pulse" />
              <span>LIVE</span>
            </span>
          </div>

          {/* Apple Liquid Glass Navigation */}
          <nav
            ref={navRef}
            className="liquid-nav header-nav"
            onMouseMove={handleMouseMove}
            aria-label="Primary"
          >
            <div className="liquid-glare-container">
              <div ref={glareRef} className="liquid-glare" />
            </div>

            <div className="nav-items">
              <div ref={pillRef} className="active-pill" />

              <NavLink
                to="/"
                end
                className={({ isActive }) => `liquid-nav-btn ${isActive ? "active" : ""}`}
              >
                <div className="btn-content">
                  <MessageSquarePlus size={15} />
                  <span>Ask</span>
                </div>
              </NavLink>

              <NavLink
                to="/wall"
                className={({ isActive }) => `liquid-nav-btn ${isActive ? "active" : ""}`}
              >
                <div className="btn-content">
                  <Layers size={15} />
                  <span>Wall</span>
                </div>
              </NavLink>
            </div>

            <div className="liquid-divider" />

            <button
              type="button"
              className="liquid-action-btn"
              onClick={() => setShowQrModal(true)}
              aria-label="Show audience QR code"
              title="Show QR code for attendees"
            >
              <div className="btn-content">
                <QrCode size={15} />
                <span className="qr-text">QR</span>
              </div>
            </button>
          </nav>
        </div>
      </header>

      <main className="shell">
        <Outlet context={{ openQrModal: () => setShowQrModal(true) }} />
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-left">
            <span>Anonymous posting · One upvote per device · Instant sync fallback for college WiFi</span>
          </div>
          <div className="footer-right">
            <span>Powered by AWS SBG &amp; MEC CSE/IT</span>
            <Link
              to="/admin"
              aria-label="Moderator sign-in"
              title="Moderator sign-in"
              style={{ fontSize: "11px", color: "rgba(158, 181, 165, 0.55)", textDecoration: "none", marginLeft: "12px" }}
            >
              Moderator
            </Link>
          </div>
        </div>
      </footer>

      <QRCodeModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
    </>
  );
}
