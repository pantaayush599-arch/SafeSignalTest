// Centralized API service layer. Every backend call in this app goes
// through the functions below rather than scattering fetch() calls across
// components (see task spec #33 "Backend <-> Frontend connection map").
import { ApiError, type ApiErrorBody } from "./types";
import type {
  AnalyzeRequestOut,
  AuditTrailOut,
  ContactInboxItem,
  DashboardOut,
  DemoIdentity,
  LoginOut,
  ManualOverrideOut,
  RequestStateOut,
  Tier3StartOut,
  Tier3SubmitOut,
  VerifyRespondOut,
} from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, null, "Could not reach the SafeSignal backend. Check your connection and try again.");
  }

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, body, `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// -------------------------------------------------------------- health
export const getHealth = () => request<{ status: string; service: string; version: string }>("/health");

// -------------------------------------------------------------- demo identities
export const getDemoIdentities = () => request<DemoIdentity[]>("/demo/identities");

// -------------------------------------------------------------- analyze
export interface AnalyzeInput {
  request_id: string;
  requester_id: string;
  action_type?: string;
  channel: string;
  claimed_identity?: string;
  amount?: number;
  deepfake_signal_score?: number;
  input_type: "TEXT" | "AUDIO";
  transcript_or_text?: string;
  audio?: string; // base64
}

export const analyzeRequest = (token: string, body: AnalyzeInput) =>
  request<AnalyzeRequestOut>("/analyze-request", { method: "POST", token, body: JSON.stringify(body) });

// -------------------------------------------------------------- request state
export const getRequestState = (token: string, requestId: string) =>
  request<RequestStateOut>(`/requests/${requestId}`, { token });

export const getAuditTrail = (token: string, requestId: string) =>
  request<AuditTrailOut>(`/requests/${requestId}/audit`, { token });

export const manualOverride = (token: string, requestId: string, reason: string) =>
  request<ManualOverrideOut>(`/requests/${requestId}/manual-override`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason, confirmation: true }),
  });

// -------------------------------------------------------------- tier1 / tier2
export const respondTier1 = (token: string, verificationId: string, response: "CONFIRMED" | "REJECTED") =>
  request<VerifyRespondOut>("/verify/tier1/respond", {
    method: "POST",
    token,
    body: JSON.stringify({ verification_id: verificationId, response }),
  });

export const respondTier2 = (token: string, verificationId: string, response: "CONFIRMED" | "REJECTED") =>
  request<VerifyRespondOut>("/verify/tier2/respond", {
    method: "POST",
    token,
    body: JSON.stringify({ verification_id: verificationId, response }),
  });

// -------------------------------------------------------------- tier3
export const startTier3 = (token: string, requestId: string, verificationId: string) =>
  request<Tier3StartOut>("/verify/tier3", {
    method: "POST",
    token,
    body: JSON.stringify({ verification_id: verificationId, request_id: requestId, tier: 3 }),
  });

export const submitTier3 = (token: string, verificationId: string, code: string) =>
  request<Tier3SubmitOut>("/verify/tier3/submit", {
    method: "POST",
    token,
    body: JSON.stringify({ verification_id: verificationId, code }),
  });

// -------------------------------------------------------------- contacts
export const getContactInbox = (token: string, contactId: string) =>
  request<ContactInboxItem[]>(`/contacts/${contactId}/inbox`, { token });

// -------------------------------------------------------------- auth
export const loginWithFirebaseToken = (idToken: string) =>
  request<LoginOut>("/auth/login", { method: "POST", body: JSON.stringify({ id_token: idToken }) });

// -------------------------------------------------------------- panic button
export const triggerPanic = (token: string, note?: string) =>
  request<AnalyzeRequestOut>("/panic", { method: "POST", token, body: JSON.stringify({ note }) });

// -------------------------------------------------------------- family dashboard
export const getDashboard = (token: string, requesterId: string) =>
  request<DashboardOut>(`/requesters/${requesterId}/dashboard`, { token });
