export type WorkflowStatus =
  | "FINDING_RECEIVED" | "PLANNING" | "AWAITING_APPROVAL" | "VERIFYING"
  | "VERIFICATION_FAILED" | "VERIFIED" | "POLICY_REJECTED" | "USER_REJECTED"
  | "RETRY_EXHAUSTED" | "EXECUTION_ERROR" | "UNKNOWN";

export interface Finding {
  id: string; type: string; severity: string; file_path: string;
  description: string; status?: WorkflowStatus; created_at?: string;
}
export interface PatchFile {
  file_path: string;
  diff?: string;
  old_content?: string;
  new_content?: string;
  additions?: number;
  deletions?: number;
}
export interface Patch {
  job_id: string; patch_hash: string; attempt?: number; explanation?: string;
  files?: PatchFile[]; diff?: string; policy_status?: string; approval_status?: string;
  root_cause?: string; patch_text?: string; files_changed?: string[];
  status?: WorkflowStatus;
}
export interface VerificationResult {
  job_id: string; patch_hash: string; status: WorkflowStatus | string;
  tests_total?: number; tests_passed?: number; tests_failed?: number;
  failed_tests?: string[]; duration_ms?: number; execution_error?: string | null;
}
export interface Job {
  job_id: string; finding?: Finding; finding_id?: string; status: WorkflowStatus | string;
  created_at?: string; updated_at?: string; attempt?: number; patch_hash?: string;
  summary?: string; verification?: VerificationResult; [key: string]: unknown;
}
export interface WorkflowEvent {
  timestamp: string; event_type: WorkflowStatus | string; attempt?: number;
  patch_hash?: string; summary?: string; details?: unknown;
}
export interface Evidence {
  [key: string]: unknown;
}
export interface ApiErrorShape { detail?: string; message?: string; error?: string; }

export interface JobComment {
  id: string;
  job_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  comment_text: string;
  created_at: string;
}

export interface VerificationRunRecord {
  id: string;
  job_id: string;
  patch_id: string;
  patch_hash: string;
  status: string;
  created_at: string;
  completed_at?: string;
  target_app_id?: string;
  current_attempt?: number;
  test_suite_id?: string;
  evidence_digest?: string;
  finding?: Finding;
  result?: VerificationResult;
}

