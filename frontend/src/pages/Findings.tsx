import { useState } from "react";
import { Plus, RefreshCw, Search, X, AlertTriangle } from "lucide-react";
import { api } from "../api/jobs";
import { useJobs } from "../hooks/useJobs";
import FindingsTable from "../components/FindingsTable";
import type { Finding } from "../api/types";
export default function Findings() {
  const { jobs, loading, error, refresh } = useJobs();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState(new URLSearchParams(window.location.search).get("search") || "");
  async function createDemo() {
    setCreating(true); setMessage("");
    const finding: Finding = { id: "BOLA-001", type: "BROKEN_OBJECT_LEVEL_AUTHORIZATION", severity: "HIGH", file_path: "app/access.py", description: "A user can access another user's private document." };
    try { await api.createFinding({ target_app_id: "bola-demo-v1", finding }); setMessage("Finding submitted. Refreshing backend jobs…"); setShowCreate(false); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Finding creation failed."); }
    finally { setCreating(false); }
  }
  const filtered = jobs.filter(j => `${j.finding?.id || j.finding_id || ""} ${j.finding?.type || ""} ${j.finding?.file_path || ""} ${j.job_id}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="page"><div className="page-heading"><div><div className="eyebrow">DETECTION INTAKE</div><h1>Security findings</h1><p>Review incoming vulnerabilities and follow each remediation job.</p></div><button className="button button-primary" onClick={() => { setShowCreate(!showCreate); setMessage(""); }}><Plus size={16} /> Create BOLA demo finding</button></div>
    {showCreate && <section className="panel create-panel"><div className="panel-heading"><div><div className="eyebrow">PREDEFINED DEMO</div><h3>BOLA demonstration finding</h3></div><button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={16}/></button></div><p>This submits the fixed BOLA-001 payload to <code>POST /api/findings</code>. It does not create a local-only finding.</p><div className="demo-payload"><span>Target app</span><code>bola-demo-v1</code><span>File</span><code>app/access.py</code><span>Severity</span><code className="danger-text">HIGH</code></div><button className="button button-primary" disabled={creating} onClick={() => void createDemo()}>{creating ? <RefreshCw size={15} className="spin"/> : <Plus size={15}/>} Submit to backend</button></section>}
    {message && <div className="notice wide"><AlertTriangle size={15}/>{message}</div>}{error && <div className="error-banner">{error}</div>}
    <section className="panel table-panel"><div className="panel-heading"><div><div className="eyebrow">BACKEND RECORDS</div><h2>Findings & jobs <span className="subtle-count">{filtered.length}</span></h2></div><div className="table-tools"><div className="input-search"><Search size={15}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter findings…" /></div><button className="icon-button" onClick={() => void refresh()} aria-label="Refresh" disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""}/></button></div></div>{loading ? <div className="loading-state"><RefreshCw size={17} className="spin"/>Loading findings…</div> : <FindingsTable jobs={filtered}/>}</section>
  </div>;
}