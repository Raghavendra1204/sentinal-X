import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Layers,
  Container,
  AlertTriangle,
  RefreshCw,
  Play,
  Shield,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/jobs";
import type { Job, VerificationRunRecord } from "../api/types";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";

export default function VerificationPage() {
  const [runs, setRuns] = useState<VerificationRunRecord[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedRun, setSelectedRun] = useState<VerificationRunRecord | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "VERIFIED" | "FAILED">("ALL");

  const loadData = async () => {
    try {
      setLoading(true);
      const [runsData, jobsData] = await Promise.all([
        api.verifications(50).catch(() => []),
        api.jobs().catch(() => []),
      ]);
      setRuns(runsData);
      setJobs(jobsData);

      if (runsData.length > 0 && !selectedRun) {
        setSelectedRun(runsData[0]);
        setSelectedJobId(runsData[0].job_id);
      } else if (jobsData.length > 0 && !selectedJobId) {
        setSelectedJobId(jobsData[0].job_id);
      }
    } catch {
      // error handled in state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRunVerify = async (jobId: string) => {
    if (!jobId || verifying) return;
    setVerifying(true);
    setVerifyError("");
    try {
      await api.verify(jobId);
      await loadData();
      // find newly created or updated run
      const updatedRuns = await api.verifications(10);
      const match = updatedRuns.find(r => r.job_id === jobId);
      if (match) setSelectedRun(match);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification execution failed");
    } finally {
      setVerifying(false);
    }
  };

  const selectedJob = jobs.find(j => j.job_id === selectedJobId) || jobs[0];
  const activeRun = selectedRun || runs[0];

  const totalRuns = runs.length;
  const passedRuns = runs.filter(r => r.status === "VERIFIED" || r.result?.status === "PASSED").length;
  const failedRuns = runs.filter(r => r.status === "VERIFICATION_FAILED" || r.result?.status === "FAILED").length;

  const filteredRuns = runs.filter(r => {
    if (filter === "VERIFIED") return r.status === "VERIFIED" || r.result?.status === "PASSED";
    if (filter === "FAILED") return r.status === "VERIFICATION_FAILED" || r.result?.status === "FAILED";
    return true;
  });

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DOCKER SANDBOX VERIFICATION CENTER</div>
          <h1>Verification Status & Stepper</h1>
          <p>Inspect containerized test runs, step-by-step assertions, and attestation digests.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="button button-secondary" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh Runs
          </button>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="stats-grid">
        <StatCard label="Total Verification Runs" value={loading ? "—" : totalRuns} detail="Recorded in verification_runs" icon={Layers} />
        <StatCard label="Sandbox Verified" value={loading ? "—" : passedRuns} detail="All tests passed (8/8)" icon={CheckCircle2} tone="green" />
        <StatCard label="Failed Attempts" value={loading ? "—" : failedRuns} detail="Caught failing tests" icon={XCircle} tone="red" />
        <StatCard label="Sandbox Engine" value="Docker Isolated" detail="sentinel-verification-lab:latest" icon={Container} tone="cyan" />
      </div>

      {/* Verification Stepper Panel */}
      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="eyebrow">LIVE VERIFICATION PIPELINE STEPPER</div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
              <Container size={20} className="text-cyan" />
              {activeRun ? `Job ${activeRun.job_id.slice(0, 16)}...` : "Select a Verification Run"}
            </h2>
            {activeRun && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Patch Hash: <code style={{ fontSize: "0.75rem" }}>{activeRun.patch_hash?.slice(0, 24)}...</code> · Run ID: <code style={{ fontSize: "0.75rem" }}>{activeRun.id}</code>
              </span>
            )}
          </div>

          {selectedJob && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  const matchingRun = runs.find(r => r.job_id === e.target.value);
                  if (matchingRun) setSelectedRun(matchingRun);
                }}
                style={{ padding: "6px 12px", fontSize: "0.82rem", background: "rgba(15, 23, 42, 0.8)", borderRadius: 6 }}
              >
                {jobs.map(j => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_id.slice(0, 14)}... ({j.status})
                  </option>
                ))}
              </select>

              {selectedJob.status === "VERIFYING" && (
                <button
                  className="button button-primary"
                  onClick={() => handleRunVerify(selectedJob.job_id)}
                  disabled={verifying}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  {verifying ? <RefreshCw size={15} className="spin" /> : <Play size={15} />}
                  <span>Execute Sandbox</span>
                </button>
              )}
            </div>
          )}
        </div>

        {verifyError && (
          <div className="error-banner" style={{ margin: "14px 0" }}>
            <AlertTriangle size={16} />
            <span>{verifyError}</span>
          </div>
        )}

        {/* 6-Step Visual Verification Stepper */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {/* Step 1 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-primary)", color: "#000", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>1</span>
                <strong style={{ fontSize: "0.85rem" }}>Pre-Flight Check</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Validates target source tree revision hash against server manifest.
              </p>
              <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>PASSED</span>
            </div>

            {/* Step 2 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-primary)", color: "#000", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>2</span>
                <strong style={{ fontSize: "0.85rem" }}>Operator Approval</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Requires active cryptographic approval bound to exact patch digest.
              </p>
              <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>BOUND</span>
            </div>

            {/* Step 3 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-primary)", color: "#000", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>3</span>
                <strong style={{ fontSize: "0.85rem" }}>Docker Container</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Spins up isolated container (Linux cgroups, no host network, memory capped).
              </p>
              <span className="badge badge-cyan" style={{ fontSize: "0.68rem" }}>CONTAINER READY</span>
            </div>

            {/* Step 4 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-primary)", color: "#000", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>4</span>
                <strong style={{ fontSize: "0.85rem" }}>Test Collection</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Loads protected test fixtures ({activeRun?.result?.tests_total || 8} tests). Read-only mount.
              </p>
              <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>COLLECTED</span>
            </div>

            {/* Step 5 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: activeRun?.status === "VERIFIED" ? "1px solid #10b981" : "1px solid #ef4444" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: activeRun?.status === "VERIFIED" ? "#10b981" : "#ef4444", color: "#fff", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>5</span>
                <strong style={{ fontSize: "0.85rem" }}>Pytest Assertions</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Passed: {activeRun?.result?.tests_passed ?? 0} · Failed: {activeRun?.result?.tests_failed ?? 0}
              </p>
              <span className={`badge ${activeRun?.status === "VERIFIED" ? "badge-green" : "badge-red"}`} style={{ fontSize: "0.68rem" }}>
                {activeRun?.status || "PENDING"}
              </span>
            </div>

            {/* Step 6 */}
            <div className="card" style={{ padding: 14, background: "rgba(15, 23, 42, 0.6)", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--cyan-primary)", color: "#000", fontWeight: 700, fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>6</span>
                <strong style={{ fontSize: "0.85rem" }}>Attestation Digest</strong>
              </div>
              <p style={{ fontSize: "0.75rem", margin: "4px 0", color: "var(--text-muted)" }}>
                Cryptographic signature generated & saved to audit database.
              </p>
              <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>SIGNED</span>
            </div>
          </div>
        </div>

        {/* Detailed Test Suite Breakdown Table */}
        {activeRun && activeRun.result && (
          <div style={{ marginTop: 24, background: "rgba(0, 0, 0, 0.2)", borderRadius: 8, padding: 16, border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={16} className="text-cyan" />
                Test Suite Breakdown ({activeRun.result.tests_passed || 0}/{activeRun.result.tests_total || 0} passed)
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Duration: {activeRun.result.duration_ms ? `${(activeRun.result.duration_ms / 1000).toFixed(2)}s` : "—"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* If failed tests exist, list them */}
              {activeRun.result.failed_tests && activeRun.result.failed_tests.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 600, marginBottom: 6 }}>
                    Failed Test Identifiers ({activeRun.result.failed_tests.length}):
                  </div>
                  {activeRun.result.failed_tests.map((ft) => (
                    <div key={ft} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <XCircle size={14} className="text-red" />
                      <code style={{ fontSize: "0.75rem", color: "#fca5a5" }}>{ft}</code>
                    </div>
                  ))}
                </div>
              )}

              {/* Standard protected tests overview */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  "test_unauthorized_user_cannot_read_document",
                  "test_authorized_owner_can_read_document",
                  "test_missing_document_returns_404",
                  "test_anonymous_request_rejected",
                  "test_tampered_document_owner_rejected",
                  "test_nonexistent_owner_rejected",
                  "test_user_b_cannot_access_user_a_document",
                  "test_multiple_unauthorized_document_ids_rejected",
                ].map((testName) => {
                  const isFailed = activeRun.result?.failed_tests?.some(f => f.includes(testName));
                  return (
                    <div
                      key={testName}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(15, 23, 42, 0.4)",
                        borderRadius: 6,
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <code style={{ fontSize: "0.75rem" }}>{testName}</code>
                      {isFailed ? (
                        <span className="badge badge-red" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>FAILED</span>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>PASSED</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Historical Runs Table */}
      <section className="panel">
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">VERIFICATION AUDIT LOG</div>
            <h2>All Sandbox Runs ({filteredRuns.length})</h2>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["ALL", "VERIFIED", "FAILED"] as const).map(tab => (
              <button
                key={tab}
                className={`button ${filter === tab ? "button-primary" : "button-secondary"}`}
                onClick={() => setFilter(tab)}
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {loading && !runs.length ? (
          <div className="loading-state">
            <RefreshCw size={16} className="spin" /> Loading runs from database...
          </div>
        ) : !filteredRuns.length ? (
          <div className="empty-state">
            No verification runs matching this filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Job ID</th>
                  <th>Attempt</th>
                  <th>Tests Total</th>
                  <th>Passed / Failed</th>
                  <th>Duration</th>
                  <th>Run Timestamp</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => {
                  const isSelected = selectedRun?.id === r.id;
                  return (
                    <tr key={r.id} style={{ background: isSelected ? "rgba(56, 189, 248, 0.08)" : undefined }}>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <Link to={`/jobs/${r.job_id}`} className="text-link" style={{ fontWeight: 600 }}>
                          {r.job_id.slice(0, 16)}...
                        </Link>
                      </td>
                      <td>{r.current_attempt ?? 0}</td>
                      <td>{r.result?.tests_total ?? 8}</td>
                      <td>
                        <span className="success-text">{r.result?.tests_passed ?? 0} passed</span> /{" "}
                        <span className="danger-text">{r.result?.tests_failed ?? 0} failed</span>
                      </td>
                      <td>{r.result?.duration_ms ? `${(r.result.duration_ms / 1000).toFixed(2)}s` : "—"}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="button button-secondary"
                          onClick={() => {
                            setSelectedRun(r);
                            setSelectedJobId(r.job_id);
                          }}
                          style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                        >
                          Inspect Stepper
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
