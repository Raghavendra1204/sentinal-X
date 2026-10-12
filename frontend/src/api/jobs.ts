import { request } from "./client";
import type { Evidence, Finding, Job, JobComment, Patch, VerificationResult, VerificationRunRecord, WorkflowEvent } from "./types";

type BackendJob = { id: string; status: string; finding?: Finding; attempt?: number; created_at?: string; updated_at?: string; [key: string]: unknown };
type BackendEvent = { event_type: string; created_at: string; event?: { timestamp?: string; to?: string; attempt?: number; patch_hash?: string; reason?: string; from?: string } };
function normalizeJob(data: BackendJob): Job {
  if (!data.id) throw new Error("Backend returned a job without an ID.");
  return { ...data, job_id: data.id } as Job;
}
function normalizePatch(data: Patch): Patch {
  const diff = data.patch_text || "";
  const lines = diff.split("\n");
  return { ...data, diff, files: (data.files_changed || []).map(file_path => ({
    file_path, diff,
    additions: lines.filter(line => line.startsWith("+") && !line.startsWith("+++")).length,
    deletions: lines.filter(line => line.startsWith("-") && !line.startsWith("---")).length,
  })) };
}
function normalizeEvent(data: BackendEvent): WorkflowEvent {
  const event = data.event || {};
  return { timestamp: event.timestamp || data.created_at, event_type: event.to || data.event_type,
    attempt: event.attempt, patch_hash: event.patch_hash,
    summary: event.reason || (event.to ? `${event.from || "New finding"} → ${event.to}` : data.event_type.replaceAll("_", " ")),
    details: data };
}
export function verificationFromEvidence(evidence: Evidence): VerificationResult | null {
  const runs = evidence.verification_runs as Array<{ status: string; patch_hash: string; result: VerificationResult }> | undefined;
  const latest = runs?.filter(run => run.status !== "RUNNING").at(-1);
  if (!latest) return null;
  return { ...latest.result, job_id: String(evidence.job_id), patch_hash: latest.patch_hash, status: latest.status };
}
export const api = {
  health: () => request<Record<string, unknown>>("/health"),
  createFinding: (payload: { target_app_id: string; finding: Finding }) =>
    request<{ job_id: string; status: string }>("/api/findings", { method: "POST", body: JSON.stringify(payload) }),
  jobs: async () => (await request<BackendJob[]>("/api/jobs")).map(normalizeJob),
  job: async (id: string) => normalizeJob(await request<BackendJob>(`/api/jobs/${encodeURIComponent(id)}`)),
  patch: async (id: string) => normalizePatch(await request<Patch>(`/api/jobs/${encodeURIComponent(id)}/patch`)),
  plan: (id: string) => request<BackendJob>(`/api/jobs/${encodeURIComponent(id)}/plan`, { method: "POST" }),
  approval: (id: string, patch_hash: string, decision: "APPROVE" | "REJECT") =>
    request<Record<string, unknown>>(`/api/jobs/${encodeURIComponent(id)}/approval`, { method: "POST", body: JSON.stringify({ patch_hash, decision }) }),
  verify: (id: string) => request<VerificationResult>(`/api/jobs/${encodeURIComponent(id)}/verify`, { method: "POST" }, 1_020_000),
  evidence: (id: string) => request<Evidence>(`/api/jobs/${encodeURIComponent(id)}/evidence`),
  events: async (id: string) => (await request<BackendEvent[]>(`/api/jobs/${encodeURIComponent(id)}/events`)).map(normalizeEvent),
  publish: (payload: {
    filename: string;
    file_content: string;
    target_app_id?: string;
    vuln_type?: string;
    severity?: string;
    description?: string;
    author_id?: string;
    author_name?: string;
    author_role?: string;
  }) => request<{ job_id: string; status: string; finding: Finding }>("/api/publish", { method: "POST", body: JSON.stringify(payload) }),
  verifications: (limit = 50) =>
    request<VerificationRunRecord[]>(`/api/verifications?limit=${limit}`),
  comments: (id: string) =>
    request<JobComment[]>(`/api/jobs/${encodeURIComponent(id)}/comments`),
  addComment: (id: string, payload: { author_id: string; author_name: string; author_role: string; comment_text: string }) =>
    request<JobComment>(`/api/jobs/${encodeURIComponent(id)}/comments`, { method: "POST", body: JSON.stringify(payload) }),
};
export function unwrapList<T>(data: T[] | Record<string, T[]> , key: string): T[] {
  if (Array.isArray(data)) return data;
  const list = data[key];
  return Array.isArray(list) ? list : [];
}
