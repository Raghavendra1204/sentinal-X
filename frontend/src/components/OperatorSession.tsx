import React, { useState, type ReactNode } from "react";
import { ShieldCheck, RefreshCw, UserCheck, KeyRound, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { api } from "../api/jobs";
import { apiBaseUrl } from "../api/client";
import { useAuth, MOCK_USERS } from "../context/AuthContext";

export default function OperatorSession({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, login } = useAuth();
  const [selectedMock, setSelectedMock] = useState(MOCK_USERS[0]);
  const [email, setEmail] = useState(MOCK_USERS[0].email);
  const [password, setPassword] = useState("Sentinel2026!");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSelectPreset = (mock: typeof MOCK_USERS[0]) => {
    setSelectedMock(mock);
    setEmail(mock.email);
    setPassword("Sentinel2026!");
    setError("");
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await login(email, password, selectedMock.token);
      // Verify connection to backend
      await api.jobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication or API connection failed");
    } finally {
      setBusy(false);
    }
  }

  if (isAuthenticated && user) {
    return (
      <>
        {import.meta.env.VITE_EXECUTION_LABEL && (
          <div className="fixture-banner" role="status">
            {import.meta.env.VITE_EXECUTION_LABEL}
          </div>
        )}
        {children}
      </>
    );
  }

  return (
    <main className="operator-connect">
      <section className="panel operator-card" style={{ maxWidth: 540 }}>
        <div className="eyebrow" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{import.meta.env.VITE_EXECUTION_LABEL || "TEAM BEYONDSIGHT / SECURE GATEWAY"}</span>
          <span className="badge badge-cyan" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>MOCK AUTH V2</span>
        </div>

        <div style={{ textAlign: "center", margin: "16px 0 24px" }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: 12, background: "rgba(56, 189, 248, 0.1)", marginBottom: 12 }}>
            <ShieldCheck size={36} className="text-cyan" />
          </div>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 6px" }}>SENTINEL<span className="text-cyan">-X</span></h1>
          <h2 style={{ fontSize: "1.05rem", color: "var(--text-muted)", margin: 0 }}>Operator Authentication Portal</h2>
        </div>

        {/* Mock ID Preset Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Select Mock Operator Identity (1-Click Switch)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {MOCK_USERS.map((mock) => {
              const active = selectedMock.id === mock.id;
              return (
                <button
                  key={mock.id}
                  type="button"
                  onClick={() => handleSelectPreset(mock)}
                  className={`button ${active ? "button-primary" : "button-secondary"}`}
                  style={{
                    padding: "8px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    height: "auto",
                    gap: 2,
                    border: active ? "1px solid var(--cyan-primary)" : "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{mock.name}</strong>
                    {active && <CheckCircle2 size={13} className="text-cyan" />}
                  </div>
                  <span style={{ fontSize: "0.72rem", opacity: 0.8 }}>ID: {mock.id}</span>
                  <span style={{ fontSize: "0.68rem", opacity: 0.65 }}>{mock.badge}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="op-email" style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
              Operator Email
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="op-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", paddingLeft: 34 }}
              />
              <UserCheck size={16} style={{ position: "absolute", left: 10, top: 12, opacity: 0.5 }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="op-password" style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="op-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", paddingLeft: 34 }}
              />
              <Lock size={16} style={{ position: "absolute", left: 10, top: 12, opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px dashed rgba(56, 189, 248, 0.25)",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: "0.78rem",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10
          }}>
            <Sparkles size={16} className="text-cyan" style={{ flexShrink: 0 }} />
            <div>
              Connected Mock ID: <strong>{selectedMock.id}</strong> ({selectedMock.role})
              <div style={{ fontSize: "0.72rem", opacity: 0.7 }}>All database operations, uploads, and approval signatures will be tied to this operator.</div>
            </div>
          </div>

          {error && <div className="error-banner" role="alert" style={{ marginBottom: 14 }}>{error}</div>}

          <button className="button button-primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? <RefreshCw size={16} className="spin" /> : <KeyRound size={16} />}
            Authenticate as {selectedMock.name}
          </button>
        </form>

        <p className="fine-print" style={{ textAlign: "center", marginTop: 16 }}>
          Local demo session. Authenticates with mock operator credentials and syncs across the backend database.
        </p>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <a className="text-link" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem" }}>
            Backend API documentation ↗
          </a>
        </div>
      </section>
    </main>
  );
}
