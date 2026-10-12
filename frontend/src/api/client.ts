const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;
let operatorToken = "";
export function setOperatorToken(token: string) { operatorToken = token; }

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status = 0, payload?: unknown) {
    super(message); this.name = "ApiError"; this.status = status; this.payload = payload;
  }
}

export async function request<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init, signal: controller.signal,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(path.startsWith("/api/") && operatorToken ? { "X-Operator-Token": operatorToken } : {}), ...init.headers },
    });
    const raw = await response.text();
    let body: unknown = undefined;
    if (raw) { try { body = JSON.parse(raw); } catch { body = raw; } }
    if (!response.ok) {
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      throw new ApiError(String(record.detail ?? record.message ?? record.error ?? `Request failed (${response.status})`), response.status, body);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Refresh the job before submitting another action.`);
    throw new ApiError("Cannot reach the SENTINEL-X API. Check the backend URL and availability.");
  } finally { window.clearTimeout(timeout); }
}
export const apiBaseUrl = API_BASE || "(same origin)";
