import { Search, Menu, Sparkles, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const names: Record<string, string> = {
  "/": "Overview",
  "/findings": "Security findings",
  "/investigation": "Investigation",
  "/verification": "Verification center",
  "/publish": "Publish & Ingest",
  "/activity": "Agent activity",
  "/evidence": "Evidence reports",
};

export default function Header({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const title = names[location.pathname] || (location.pathname.startsWith("/jobs/") ? "Investigation details" : "SENTINEL-X");

  return (
    <header className="topbar">
      <button className="menu-trigger" onClick={onMenu} aria-label="Toggle navigation">
        <span className="menu-glyph"><Menu size={19} /></span>
        <span className="menu-word">FIELD GUIDE</span>
      </button>

      <div className="breadcrumbs">
        <span>Workspace</span>
        <span className="crumb-slash">/</span>
        <strong>{title}</strong>
      </div>

      <div className="header-search">
        <Search size={17} />
        <input
          aria-label="Search findings"
          placeholder="Search findings, jobs, patch hashes…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              navigate(`/findings?search=${encodeURIComponent(e.currentTarget.value.trim())}`);
            }
          }}
        />
        <span className="search-spark"><Sparkles size={14} /></span>
      </div>

      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(15, 23, 42, 0.4)", padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div className="avatar" title={`${user.name} (${user.id})`} style={{ width: 28, height: 28, fontSize: "0.75rem", background: "var(--cyan-primary)", color: "#000", fontWeight: 700 }}>
              {user.avatar}
            </div>
            <div style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: 1.1 }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{user.name}</span>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{user.id}</span>
            </div>
          </div>
        )}

        <button
          className="button button-secondary"
          onClick={() => {
            logout();
            window.dispatchEvent(new Event("sentinel-disconnect"));
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: "0.8rem" }}
          title="Sign out of current operator identity"
        >
          <LogOut size={14} />
          <span>Log Out</span>
        </button>
      </div>
    </header>
  );
}
