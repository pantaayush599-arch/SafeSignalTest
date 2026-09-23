import {
  Phone, AlertTriangle, Eye, CheckCircle2, Send, XCircle, Clock, KeyRound,
  Lock, Unlock, ShieldAlert, HelpCircle,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

interface EventVisual {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
}

const MAP: Record<string, EventVisual> = {
  REQUEST_RECEIVED: { icon: Phone, color: "var(--color-cyan)" },
  LOW_RISK_ALLOWED: { icon: CheckCircle2, color: "var(--color-success)" },
  MEDIUM_RISK_REVIEW: { icon: Eye, color: "var(--color-cyan)" },
  HIGH_RISK_DETECTED: { icon: AlertTriangle, color: "var(--color-risk-high)" },
  AUDIO_UNPROCESSABLE: { icon: AlertTriangle, color: "var(--color-risk-high)" },
  STT_FAILED: { icon: AlertTriangle, color: "var(--color-risk-high)" },
  TIER1_STARTED: { icon: Send, color: "var(--color-cyan)" },
  TIER2_STARTED: { icon: Send, color: "var(--color-cyan)" },
  TIER3_STARTED: { icon: KeyRound, color: "var(--color-cyan)" },
  TIER1_CONFIRMED: { icon: CheckCircle2, color: "var(--color-success)" },
  TIER2_CONFIRMED: { icon: CheckCircle2, color: "var(--color-success)" },
  TIER3_CONFIRMED: { icon: CheckCircle2, color: "var(--color-success)" },
  TIER1_REJECTED: { icon: XCircle, color: "var(--color-risk-high)" },
  TIER2_REJECTED: { icon: XCircle, color: "var(--color-risk-high)" },
  TIER3_WRONG_CODE: { icon: KeyRound, color: "var(--color-risk-high)" },
  TIER1_TIMEOUT: { icon: Clock, color: "var(--color-status-timedout)" },
  TIER2_TIMEOUT: { icon: Clock, color: "var(--color-status-timedout)" },
  TIER3_EXPIRED: { icon: Clock, color: "var(--color-status-timedout)" },
  TIER3_ATTEMPTS_EXHAUSTED: { icon: Lock, color: "var(--color-status-timedout)" },
  ACTION_ALLOWED: { icon: Unlock, color: "var(--color-success)" },
  ACTION_PAUSED: { icon: Lock, color: "var(--color-gold)" },
  ACTION_ADVISORY_REVIEW: { icon: Eye, color: "var(--color-cyan)" },
  ACTION_UNLOCKED: { icon: Unlock, color: "var(--color-success)" },
  MANUAL_OVERRIDE: { icon: AlertTriangle, color: "var(--color-gold)" },
  REQUEST_TIMED_OUT: { icon: Clock, color: "var(--color-status-timedout)" },
  PANIC_TRIGGERED: { icon: ShieldAlert, color: "var(--color-danger)" },
};

export function getEventVisual(event: string): EventVisual {
  return MAP[event] ?? { icon: HelpCircle, color: "var(--color-text-faint)" };
}
