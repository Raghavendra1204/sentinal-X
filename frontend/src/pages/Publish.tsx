import { useState } from "react";
import {
  UploadCloud,
  FileCode,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/jobs";
import { useAuth } from "../context/AuthContext";
import JobComments from "../components/JobComments";

const SAMPLE_PRESETS = [
  {
    label: "C Source (Buffer Vulnerability)",
    filename: "memory_buffer.c",
    vulnType: "BUFFER_OVERFLOW",
    severity: "HIGH",
    target: "embedded-auth-service",
    description: "Unchecked strcpy into fixed stack buffer allowing heap/stack manipulation.",
    content: `/* C Memory Buffer Vulnerability */
#include <stdio.h>
#include <string.h>

void process_user_input(const char *input) {
    char buffer[64];
    // VULNERABLE: Direct strcpy without bounds checking
    strcpy(buffer, input);
    printf("Processed input: %s\\n", buffer);
}

int main(int argc, char **argv) {
    if (argc > 1) {
        process_user_input(argv[1]);
    }
    return 0;
}
`,
  },
  {
    label: "Python (BOLA Access Guard)",
    filename: "app/access.py",
    vulnType: "BROKEN_OBJECT_LEVEL_AUTHORIZATION",
    severity: "HIGH",
    target: "bola-demo-v1",
    description: "The document access function omits an ownership check, allowing unauthorized access.",
    content: `# Python Broken Object-Level Authorization (BOLA)
DOCUMENTS = {
    "doc_alice_1": {"owner_id": "alice", "title": "Confidential Report"},
    "doc_bob_1": {"owner_id": "bob", "title": "Bob's Payroll Data"},
}

def get_document(document_id: str, requesting_user_id: str | None = None) -> dict:
    if document_id not in DOCUMENTS:
        raise KeyError(f"Document {document_id} not found")
    doc = DOCUMENTS[document_id]
    
    # VULNERABLE: Fails to check requesting_user_id == doc['owner_id']
    return dict(doc)
`,
  },
  {
    label: "Dockerfile (Root Escalation)",
    filename: "Dockerfile",
    vulnType: "PRIVILEGE_ESCALATION",
    severity: "MEDIUM",
    target: "api-gateway-container",
    description: "Container runs as privileged root with exposed build secrets.",
    content: `# Insecure Dockerfile Sample
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# VULNERABLE: Running as root by omitting non-root USER directive
EXPOSE 8080
CMD ["python", "main.py"]
`,
  },
];

export default function PublishPage() {
  const { user } = useAuth();

  const [filename, setFilename] = useState("app/access.py");
  const [targetAppId, setTargetAppId] = useState("bola-demo-v1");
  const [vulnType, setVulnType] = useState("BROKEN_OBJECT_LEVEL_AUTHORIZATION");
  const [severity, setSeverity] = useState("HIGH");
  const [description, setDescription] = useState("The document access function omits an ownership check.");
  const [fileContent, setFileContent] = useState(SAMPLE_PRESETS[1].content);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdJob, setCreatedJob] = useState<{ job_id: string; status: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text || "");
    };
    reader.readAsText(file);
  };

  const handleApplyPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setFilename(preset.filename);
    setTargetAppId(preset.target);
    setVulnType(preset.vulnType);
    setSeverity(preset.severity);
    setDescription(preset.description);
    setFileContent(preset.content);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent.trim() || submitting) return;

    setSubmitting(true);
    setError("");
    setCreatedJob(null);

    try {
      const res = await api.publish({
        filename: filename.trim(),
        file_content: fileContent,
        target_app_id: targetAppId.trim(),
        vuln_type: vulnType,
        severity,
        description: description.trim(),
        author_id: user?.id || "OP-OPERATOR",
        author_name: user?.name || "Security Operator",
        author_role: user?.role || "Authorized Verifier",
      });

      setCreatedJob(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing job failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE INGESTION & PIPELINE TRIGGER</div>
          <h1>Publish Security Target</h1>
          <p>Upload source code (.c, .py, Dockerfile, etc.), declare vulnerabilities, and trigger the analysis pipeline.</p>
        </div>
      </div>

      {/* Preset Quick Fill Pills */}
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 10 }}>
          Quick Ingestion Presets:
        </span>
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {SAMPLE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="button button-secondary"
              onClick={() => handleApplyPreset(p)}
              style={{ fontSize: "0.75rem", padding: "4px 10px" }}
            >
              <Sparkles size={12} className="text-cyan" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {createdJob && (
        <div
          className="panel"
          style={{
            marginBottom: 24,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid #10b981",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <CheckCircle2 size={24} className="text-green" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
                  Job Successfully Created: <code style={{ color: "var(--cyan-primary)" }}>{createdJob.job_id}</code>
                </h3>
                <span className="badge badge-cyan">{createdJob.status}</span>
              </div>
              <p style={{ margin: "4px 0 12px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Target file <strong>{filename}</strong> is now registered across the entire SQLite database and connected to Mock Operator <strong>{user?.name} ({user?.id})</strong>.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to={`/jobs/${createdJob.job_id}`} className="button button-primary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                  <span>Open Investigation</span> <ArrowRight size={14} />
                </Link>
                <Link to="/verification" className="button button-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                  <span>View in Verification Tab</span>
                </Link>
                <Link to="/" className="button button-secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
                  <span>Check Overview Stats</span>
                </Link>
              </div>

              {/* Directly embedded comments for the newly created job */}
              <div style={{ marginTop: 16 }}>
                <JobComments jobId={createdJob.job_id} />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-banner" style={{ marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {/* Left: Metadata */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">FILE & TARGET ATTRIBUTES</div>
                <h2>Target Configuration</h2>
              </div>
              <FileCode size={18} className="text-cyan" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                  Target File Name (Customizable)
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g. app/access.py, driver.c, Dockerfile"
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                    Target App ID
                  </label>
                  <input
                    type="text"
                    value={targetAppId}
                    onChange={(e) => setTargetAppId(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                    Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                  Vulnerability Classification
                </label>
                <select
                  value={vulnType}
                  onChange={(e) => setVulnType(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="BROKEN_OBJECT_LEVEL_AUTHORIZATION">BROKEN_OBJECT_LEVEL_AUTHORIZATION (BOLA)</option>
                  <option value="BUFFER_OVERFLOW">BUFFER_OVERFLOW & MEMORY CORRUPTION</option>
                  <option value="PRIVILEGE_ESCALATION">PRIVILEGE_ESCALATION (CONTAINER / ROOT)</option>
                  <option value="INJECTION">INJECTION (SQL / COMMAND)</option>
                  <option value="CODE_AUDIT">GENERAL CODE SECURITY AUDIT</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: 4 }}>
                  Vulnerability Description / Problem Statement
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  style={{ width: "100%", fontSize: "0.82rem" }}
                />
              </div>

              {/* File Upload Dropzone */}
              <div
                style={{
                  border: "2px dashed rgba(56, 189, 248, 0.3)",
                  borderRadius: 8,
                  padding: "16px 14px",
                  textAlign: "center",
                  background: "rgba(15, 23, 42, 0.4)",
                  cursor: "pointer",
                }}
              >
                <UploadCloud size={28} className="text-cyan" style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Choose file from disk or drag & drop</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Supports .c, .py, .h, Dockerfile, .sh, .json, .yaml, .txt
                </div>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  style={{ marginTop: 10, fontSize: "0.78rem" }}
                />
              </div>
            </div>
          </section>

          {/* Right: Code Preview Window */}
          <section className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="eyebrow">SOURCE CODE EDITOR</div>
                <h2>{filename}</h2>
              </div>
              <span className="badge badge-cyan" style={{ fontSize: "0.7rem" }}>
                {fileContent.split("\n").length} Lines
              </span>
            </div>

            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                minHeight: 360,
                fontFamily: "monospace",
                fontSize: "0.82rem",
                lineHeight: 1.5,
                background: "#090d16",
                color: "#e2e8f0",
                padding: 14,
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                resize: "vertical",
              }}
              placeholder="Paste or upload code here..."
            />

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Operator Author: <strong>{user?.name}</strong> ({user?.id})
              </div>
              <button
                type="submit"
                className="button button-primary"
                disabled={submitting || !fileContent.trim()}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px" }}
              >
                {submitting ? <RefreshCw size={16} className="spin" /> : <UploadCloud size={16} />}
                <span>Publish & Ingest Job</span>
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
