import { useState, useMemo, useEffect, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import QuestionCard from "../components/QuestionCard";
import { useQuestions } from "../hooks/useQuestions";
import { POLL_INTERVAL_MS } from "../lib/firebase";
import {
  Search,
  Maximize2,
  Minimize2,
  QrCode,
  RefreshCw,
  Flame,
  Sparkles,
  Clock,
  Grid,
  List,
  ThumbsUp,
  Radio,
  PlusCircle,
  MessageSquare,
} from "lucide-react";

type FilterTab = "all" | "top" | "featured" | "recent";

interface ContextType {
  openQrModal: () => void;
}

export default function Wall() {
  const { rows, loading, error, voted, lastSync, refresh, upvote } = useQuestions("wall");
  const { openQrModal } = useOutletContext<ContextType>();

  const [voteError, setVoteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [isCompact, setIsCompact] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filterTrackRef = useRef<HTMLDivElement | null>(null);
  const filterPillRef = useRef<HTMLDivElement | null>(null);
  const filterGlareRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function updateFilterPill() {
      if (!filterTrackRef.current || !filterPillRef.current) return;
      const activeBtn = filterTrackRef.current.querySelector<HTMLElement>(".filter-tab.active");
      if (!activeBtn) return;
      filterPillRef.current.style.width = `${activeBtn.offsetWidth}px`;
      filterPillRef.current.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    }
    const timer = setTimeout(updateFilterPill, 30);
    window.addEventListener("resize", updateFilterPill);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateFilterPill);
    };
  }, [activeTab]);

  function handleFilterGlare(e: React.MouseEvent<HTMLDivElement>) {
    if (!filterTrackRef.current || !filterGlareRef.current) return;
    const rect = filterTrackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    filterGlareRef.current.style.setProperty("--x", `${x}px`);
    filterGlareRef.current.style.setProperty("--y", `${y}px`);
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  }

  async function handleUpvote(id: string): Promise<void> {
    setVoteError(null);
    try {
      await upvote(id);
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Upvote failed.");
    }
  }

  const totalVotes = useMemo(() => {
    return rows.reduce((acc, q) => acc + (q.upvote_count || 0), 0);
  }, [rows]);

  const featuredCount = useMemo(() => {
    return rows.filter((q) => q.status === "featured").length;
  }, [rows]);

  // Filter & search questions
  const filteredRows = useMemo(() => {
    let list = [...rows];

    // Filter by search keyword or handle
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.body.toLowerCase().includes(q) ||
          item.display_handle.toLowerCase().includes(q)
      );
    }

    // Filter by tab
    if (activeTab === "featured") {
      return list.filter((item) => item.status === "featured");
    }
    if (activeTab === "top") {
      return [...list].sort((a, b) => b.upvote_count - a.upvote_count);
    }
    if (activeTab === "recent") {
      return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    // Default 'all': featured on top, then sorted by votes
    return list;
  }, [rows, search, activeTab]);

  const featuredCards = filteredRows.filter((q) => q.status === "featured");
  const regularCards = activeTab === "featured" ? [] : filteredRows.filter((q) => q.status !== "featured");

  return (
    <div className={`wall-page ${isFullscreen ? "projector-mode" : ""}`}>
      {/* Wall Header & Stats Bar */}
      <div className="wall-header-section">
        <div className="wall-title-lockup">
          <div className="wall-eyebrow">
            <span className="live-tag">
              <Radio size={12} className="live-dot-pulse" />
              <span>LIVE WALL</span>
            </span>
            <span>Auditorium Projector · Syncing every {Math.round(POLL_INTERVAL_MS / 1000)}s</span>
          </div>
          <h1 className="wall-main-title">Audience Questions</h1>
        </div>

        {/* Stats Strip */}
        <div className="wall-stats-strip">
          <div className="stat-pill glass">
            <MessageSquare size={16} className="text-phosphor" />
            <span className="stat-num">{rows.length}</span>
            <span className="stat-label">Questions</span>
          </div>

          <div className="stat-pill glass">
            <Sparkles size={16} className="text-amber" />
            <span className="stat-num">{featuredCount}</span>
            <span className="stat-label">Featured</span>
          </div>

          <div className="stat-pill glass">
            <ThumbsUp size={16} className="text-teal" />
            <span className="stat-num">{totalVotes}</span>
            <span className="stat-label">Total Upvotes</span>
          </div>
        </div>
      </div>

      {/* Floating Sticky Wall Control Toolbar */}
      <div className="wall-control-bar glass" role="toolbar" aria-label="Wall controls">
        <div className="wall-control-top">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search questions or handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search questions"
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="wall-actions">
            <button
              type="button"
              className="toolbar-btn"
              onClick={openQrModal}
              title="Display QR code on projector for audience"
              aria-label="Display audience QR code"
            >
              <QrCode size={16} />
              <span className="btn-label-desktop">Show QR</span>
            </button>

            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setIsCompact(!isCompact)}
              title={isCompact ? "Switch to grid view" : "Switch to compact view"}
              aria-label="Toggle compact view"
            >
              {isCompact ? <Grid size={16} /> : <List size={16} />}
              <span className="btn-label-desktop">{isCompact ? "Grid" : "Compact"}</span>
            </button>

            <button
              type="button"
              className="toolbar-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Projector Fullscreen Mode"}
              aria-label="Toggle Fullscreen Projector Mode"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="btn-label-desktop">{isFullscreen ? "Exit" : "Projector"}</span>
            </button>

            <button
              type="button"
              className={`toolbar-btn ${isRefreshing ? "spin-refresh" : ""}`}
              onClick={() => void handleRefresh()}
              title="Refresh questions now"
              aria-label="Refresh questions"
            >
              <RefreshCw size={16} />
              <span className="btn-label-desktop">Sync</span>
            </button>
          </div>
        </div>

        {/* Apple Liquid Glass Filter Track */}
        <div
          ref={filterTrackRef}
          className="liquid-nav filter-nav-track"
          onMouseMove={handleFilterGlare}
          role="tablist"
        >
          <div className="liquid-glare-container">
            <div ref={filterGlareRef} className="liquid-glare" />
          </div>

          <div className="nav-items">
            <div ref={filterPillRef} className="active-pill" />

            <button
              type="button"
              className={`filter-tab liquid-nav-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
              role="tab"
              aria-selected={activeTab === "all"}
            >
              <div className="btn-content">
                <span>All ({rows.length})</span>
              </div>
            </button>
            <button
              type="button"
              className={`filter-tab liquid-nav-btn ${activeTab === "top" ? "active" : ""}`}
              onClick={() => setActiveTab("top")}
              role="tab"
              aria-selected={activeTab === "top"}
            >
              <div className="btn-content">
                <Flame size={13} className="text-amber" />
                <span>Top Voted</span>
              </div>
            </button>
            <button
              type="button"
              className={`filter-tab liquid-nav-btn ${activeTab === "featured" ? "active" : ""}`}
              onClick={() => setActiveTab("featured")}
              role="tab"
              aria-selected={activeTab === "featured"}
            >
              <div className="btn-content">
                <Sparkles size={13} className="text-gold" />
                <span>Featured ({featuredCount})</span>
              </div>
            </button>
            <button
              type="button"
              className={`filter-tab liquid-nav-btn ${activeTab === "recent" ? "active" : ""}`}
              onClick={() => setActiveTab("recent")}
              role="tab"
              aria-selected={activeTab === "recent"}
            >
              <div className="btn-content">
                <Clock size={13} />
                <span>Recent</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {lastSync && (
        <div className="sync-status-bar">
          <span className="sync-dot" />
          <span>Synced at {new Date(lastSync).toLocaleTimeString()}</span>
          {search && (
            <span className="search-match-text">
              · Found {filteredRows.length} {filteredRows.length === 1 ? "question" : "questions"} matching "{search}"
            </span>
          )}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="notice enter">
          <RefreshCw size={16} className="spinner spin-refresh" />
          <span>Connecting to live feed...</span>
        </div>
      )}

      {error && (
        <div className="notice amber enter" role="alert">
          {error}
        </div>
      )}

      {voteError && (
        <div className="notice notice-error enter" role="alert">
          {voteError}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRows.length === 0 && (
        <div className="panel glass empty-wall-panel enter">
          <div className="empty-wall-icon">
            {activeTab === "featured" && !search ? (
              <Sparkles size={36} className="text-gold" aria-hidden="true" />
            ) : (
              <MessageSquare size={36} className="text-amber" aria-hidden="true" />
            )}
          </div>
          <h2>
            {search
              ? "No matching questions found"
              : activeTab === "featured"
                ? "Nothing pinned to the spotlight yet"
                : "No approved questions yet"}
          </h2>
          <p className="lede">
            {search
              ? "Try searching for a different keyword, or clear your search."
              : activeTab === "featured"
                ? rows.length > 0
                  ? "A moderator has not pinned anything yet. Browse all live questions while you wait."
                  : "Be the first attendee to post! Scan the QR code or tap below to ask anonymously from your phone."
                : "Be the first attendee to post! Scan the QR code or tap below to ask anonymously from your phone."}
          </p>
          <div className="empty-wall-actions">
            {search ? (
              <button type="button" className="btn ghost" onClick={() => setSearch("")}>
                Clear Search
              </button>
            ) : activeTab === "featured" && rows.length > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setActiveTab("all")}>
                View all live questions
              </button>
            ) : (
              <>
                <Link to="/" className="btn btn-cta" style={{ textDecoration: "none" }}>
                  <PlusCircle size={18} />
                  <span>Ask a Question</span>
                </Link>
                <button type="button" className="btn ghost" onClick={openQrModal}>
                  <QrCode size={18} />
                  <span>Display QR Code</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Featured Spotlight Grid */}
      {featuredCards.length > 0 && (
        <section className="wall-featured-section enter" aria-label="Pinned spotlight questions">
          <div className="section-label">
            <Sparkles size={16} className="text-gold" aria-hidden="true" />
            <span>Pinned to top · Spotlight ({featuredCards.length})</span>
          </div>
          <div className={`wall-featured ${isCompact ? "compact-layout" : ""}`}>
            {featuredCards.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                voted={voted.has(q.id)}
                onUpvote={(id) => void handleUpvote(id)}
                compact={isCompact}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* Regular Approved Grid */}
      {regularCards.length > 0 && (
        <section className="wall-regular-section" aria-label="Community Questions">
          {featuredCards.length > 0 && (
            <div className="section-label" style={{ marginTop: 24 }}>
              <ThumbsUp size={15} className="text-teal" />
              <span>Community Questions ({regularCards.length})</span>
            </div>
          )}
          <div className={`wall-grid ${isCompact ? "compact-layout" : ""}`}>
            {regularCards.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                voted={voted.has(q.id)}
                onUpvote={(id) => void handleUpvote(id)}
                compact={isCompact}
                index={i + featuredCards.length}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
