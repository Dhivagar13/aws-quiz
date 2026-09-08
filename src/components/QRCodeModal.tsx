import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, ExternalLink, QrCode } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRCodeModal({ isOpen, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [url] = useState(() =>
    typeof window !== "undefined" ? window.location.origin + "/" : ""
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <div className="glass-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <div className="glass-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="glass-modal-header">
          <div className="glass-modal-title">
            <QrCode className="icon-amber" size={22} />
            <h2 id="qr-title" style={{ margin: 0, fontSize: "1.25rem" }}>Scan to Ask Questions</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close QR code modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="modal-description">
          Point your phone camera to open the live Q&amp;A on your device. No app or registration required.
        </p>

        <div className="qr-container">
          <div className="qr-box">
            {url && (
              <QRCodeSVG
                value={url}
                size={220}
                level="M"
                includeMargin
                imageSettings={{
                  src: "/vite.svg",
                  x: undefined,
                  y: undefined,
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            )}
          </div>
        </div>

        <div className="qr-url-chip">
          <span className="qr-url-text">{url}</span>
          <button
            type="button"
            className="btn ghost small"
            onClick={handleCopy}
            aria-label="Copy Q&A link"
          >
            {copied ? <Check size={16} className="text-phosphor" /> : <Copy size={16} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        <div className="modal-actions">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="btn ghost small"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <ExternalLink size={16} />
            <span>Open in new tab</span>
          </a>
        </div>
      </div>
    </div>
  );
}
