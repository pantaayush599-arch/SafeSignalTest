// Mirrors backend/app/enums.py and schemas.py exactly. Do not rename values
// here without renaming them in the backend contract too.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Decision = "ALLOW" | "PAUSE" | "BLOCK" | "REVIEW";
export type AuthProvider = "PHONE" | "GOOGLE";
export type RequestStatus =
  | "PENDING"
  | "VERIFIED"
  | "STAYS-PAUSED"
  | "TIMED-OUT"
  | "MANUAL-OVERRIDE";
export type VerificationStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "TIMED_OUT";
export type InputType = "TEXT" | "AUDIO";
export type Channel = "voice_call" | "video_call" | "text";
export type ContactType = "PRIMARY" | "SECONDARY";

export interface AnalyzeRequestOut {
  request_id: string;
  transcript_or_text?: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  decision: Decision;
  reason_codes: string[];
  verification_required: boolean;
  request_status: RequestStatus;
}

export interface VerificationSummary {
  verification_id: string;
  tier: number;
  status: VerificationStatus;
  sent_at: string;
  expires_at: string;
  responded_at?: string | null;
}

export interface RequestStateOut {
  request_id: string;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
  decision?: Decision | null;
  reason_codes: string[];
  transcript_or_text?: string | null;
  amount?: number | null;
  claimed_identity?: string | null;
  channel?: string | null;
  caller_phone_number?: string | null;
  known_contact_checked: boolean;
  known_contact_match?: boolean | null;
  known_contact_name?: string | null;
  reported_scam_number: boolean;
  scam_report_count: number;
  verification_required: boolean;
  request_status: RequestStatus;
  current_tier?: number | null;
  override_reason?: string | null;
  override_at?: string | null;
  created_at: string;
  verifications: VerificationSummary[];
}

export interface ContactInboxItem {
  verification_id: string;
  request_id: string;
  tier: number;
  status: VerificationStatus;
  sent_at: string;
  expires_at: string;
  escalation_reason?: string | null;
  demo_code?: string | null;
  request_status: RequestStatus;
  claimed_identity?: string | null;
  amount?: number | null;
  channel?: string | null;
  risk_level?: RiskLevel | null;
  risk_score?: number | null;
  reason_codes: string[];
  transcript_or_text?: string | null;
}

export interface VerifyRespondOut {
  verification_id: string;
  request_id: string;
  tier: number;
  status: VerificationStatus;
  request_status: RequestStatus;
  responded_at?: string | null;
}

export interface Tier3StartOut {
  verification_id: string;
  request_id: string;
  tier: number;
  status: VerificationStatus;
  expires_at: string;
  attempts_remaining: number;
  demo_code?: string | null;
}

export interface Tier3SubmitOut {
  verification_id: string;
  request_id: string;
  tier: number;
  status: VerificationStatus;
  request_status?: RequestStatus | null;
  attempts_remaining?: number | null;
}

export interface ManualOverrideOut {
  request_id: string;
  request_status: RequestStatus;
  override_at: string;
}

export interface AuditEventOut {
  event: string;
  timestamp: string;
  details?: Record<string, unknown> | null;
}

export interface AuditTrailOut {
  request_id: string;
  events: AuditEventOut[];
}

export interface DemoIdentity {
  role: "requester" | "contact";
  id: string;
  name: string;
  token: string;
  requester_id?: string | null; // set for role="contact": which requester's family they belong to
  relationship?: string | null; // set for role="contact"
}

export interface ContactOut {
  contact_id: string;
  requester_id: string;
  contact_name: string;
  relationship?: string | null;
  phone_number: string;
  contact_type: ContactType;
  auth_token?: string | null;
}

export interface LoginOut {
  requester_id: string;
  name: string;
  auth_provider?: AuthProvider | null;
  phone_number?: string | null;
  email?: string | null;
  session_token: string;
  created: boolean;
}

export interface DashboardEntry {
  request_id: string;
  risk_level?: RiskLevel | null;
  risk_score?: number | null;
  request_status: RequestStatus;
  claimed_identity?: string | null;
  amount?: number | null;
  triggered_by_panic: boolean;
  created_at: string;
}

export interface DashboardOut {
  requester_id: string;
  requester_name: string;
  entries: DashboardEntry[];
}

export interface ScamReportOut {
  report_id: string;
  phone_number: string;
  reason?: string | null;
  created_at: string;
}

export interface ScamNumberLookupOut {
  phone_number: string;
  reported: boolean;
  report_count: number;
}

export interface ApiErrorBody {
  error?: {
    code: string;
    message: string;
    request_id?: string;
  };
  request_status?: RequestStatus;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  request_status?: RequestStatus;

  constructor(status: number, body: ApiErrorBody | null, fallbackMessage: string) {
    super(body?.error?.message || fallbackMessage);
    this.status = status;
    this.code = body?.error?.code;
    this.request_status = body?.request_status;
  }
}
