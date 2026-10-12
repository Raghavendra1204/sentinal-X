import { useState } from "react";
import { Check, X, ShieldCheck, AlertTriangle, LoaderCircle, Sparkles } from "lucide-react";
import { api } from "../api/jobs";
import type { Job, Patch } from "../api/types";
import StatusBadge from "./StatusBadge";

export default function ApprovalPanel({ job, patch, onUpdated }: { job: Job | null; patch: Patch | null; onUpdated: () => void }) {
  const [busy, setBusy] = useState<"APPROVE" | "REJECT" | "PLAN" | null>(null);
  const [message, setMessage] = useState("");
  const canDecide = Boolean(job?.job_id && patch?.patch_hash && (job.status === "AWAITING_APPROVAL" && patch.policy_status === "PASSED"));
  const canPlan = Boolean(job?.job_id && (job.status === "FINDING_RECEIVED" || job.status === "EXECUTION_ERROR"));

  async function triggerPlan() {
    if (!job?.job_id || busy || !canPlan) return;
    setBusy("PLAN"); setMessage("");
    try {
      await api.plan(job.job_id);
      setMessage("AI remediation triggered. Generating patch proposal with Qwen 2.5 Coder…");
      onUpdated();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Planning failed to start.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!job?.job_id || !patch?.patch_hash || busy || !canDecide) return;
    setBusy(decision); setMessage("");
    try {
      await api.approval(job.job_id, patch.patch_hash, decision);
      setMessage(decision === "APPROVE" ? "Approval recorded by backend." : "Rejection recorded by backend.");
      onUpdated();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Decision failed. No local approval was recorded."); }
    finally { setBusy(null); }
  }
  return <section className="panel approval-panel">
    <div className="panel-heading"><div><div className="eyebrow">HUMAN CONTROL</div><h3>Patch decision</h3></div><ShieldCheck size={18} className="text-cyan" /></div>
    <div className="approval-status"><span>Current state</span><StatusBadge status={patch?.approval_status || job?.status} /></div>
    <div className="hash-label">PATCH SHA-256</div><code className="hash-value">{patch?.patch_hash || "Not provided by backend"}</code>
    
    {canPlan && (
      <div style={{ marginTop: 12, marginBottom: 12, padding: 12, background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.3)", borderRadius: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", fontWeight: 600, color: "var(--cyan-primary)", marginBottom: 6 }}>
          <Sparkles size={16} /> <span>AI Patch Remediation Ready</span>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Run local Qwen 2.5 Coder to synthesize a security guard patch and advance this job to approval.
        </p>
        <button
          className="button button-primary"
          style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
          disabled={!!busy}
          onClick={() => void triggerPlan()}
        >
          {busy === "PLAN" ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
          <span>{busy === "PLAN" ? "Synthesizing patch (Qwen)…" : "Generate AI Patch with Qwen"}</span>
        </button>
      </div>
    )}

    {!canDecide && !canPlan && <div className="notice"><AlertTriangle size={15} /><span>Decision controls are disabled until the backend reports a pending approval for the current patch.</span></div>}
    {message && <div className="inline-message">{message}</div>}
    <div className="approval-actions"><button className="button button-danger-ghost" disabled={!canDecide || !!busy} onClick={() => void decide("REJECT")}>{busy === "REJECT" ? <LoaderCircle size={15} className="spin" /> : <X size={15} />} Reject patch</button><button className="button button-primary" disabled={!canDecide || !!busy} onClick={() => void decide("APPROVE")}>{busy === "APPROVE" ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />} Approve patch</button></div>
    <p className="fine-print">Approval is bound to this exact patch hash. A revised patch requires a new backend approval.</p>
  </section>;
}