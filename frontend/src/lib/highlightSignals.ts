// Mirrors the shape of backend/app/risk_engine.py's SIGNAL_RULES closely
// enough to highlight the actual words that likely triggered each signal,
// for display only. Only ever highlights signals the backend actually
// reported in reason_codes -- never invents a highlight for a signal that
// wasn't detected.
export interface HighlightRule {
  code: string;
  label: string;
  patterns: RegExp[];
}

export const HIGHLIGHT_RULES: HighlightRule[] = [
  {
    code: "money_request",
    label: "Money request",
    patterns: [/send\b[^.!?]{0,25}/gi, /\b(rs\.?|inr|₹)\s?[\d,]+/gi, /pay\b[^.!?]{0,15}now/gi, /\bneed\b[^.!?]{0,15}money/gi],
  },
  {
    code: "credential_otp_request",
    label: "OTP / credential request",
    patterns: [/\botp\b/gi, /\bone[- ]time password\b/gi, /\bpin\b/gi, /\bcvv\b/gi, /\bpassword\b/gi, /\bverification code\b/gi],
  },
  {
    code: "emergency_claim",
    label: "Emergency claim",
    patterns: [/\barrested\b/gi, /\baccident\b/gi, /\bhospital\b/gi, /\bemergency\b/gi, /\bpolice\b/gi, /\bdetained\b/gi, /\bbail\b/gi, /\bkidnap\w*/gi],
  },
  {
    code: "secrecy_request",
    label: "Secrecy",
    patterns: [/don'?t\s+tell\s+\w+/gi, /do not\s+tell\s+\w+/gi, /keep[^.!?]{0,15}secret/gi, /don'?t[^.!?]{0,15}anyone/gi],
  },
  {
    code: "urgency_keyword",
    label: "Urgency",
    patterns: [/\bright now\b/gi, /\bimmediately\b/gi, /\burgent(ly)?\b/gi, /\bas soon as possible\b/gi, /\basap\b/gi, /\bhurry\b/gi],
  },
  {
    code: "unusual_amount_flag",
    label: "Unusual amount",
    patterns: [/\b\d{2,3}[,.]?\d{3}\b/g],
  },
];

export interface TranscriptSegment {
  text: string;
  code: string | null;
  label: string | null;
}

export function highlightTranscript(transcript: string, detectedCodes: string[]): TranscriptSegment[] {
  const activeRules = HIGHLIGHT_RULES.filter((r) => detectedCodes.includes(r.code));
  if (activeRules.length === 0 || !transcript) {
    return [{ text: transcript, code: null, label: null }];
  }

  type Match = { start: number; end: number; code: string; label: string };
  const matches: Match[] = [];
  for (const rule of activeRules) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      let m: RegExpExecArray | null;
      while ((m = re.exec(transcript)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, code: rule.code, label: rule.label });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  }
  if (matches.length === 0) {
    return [{ text: transcript, code: null, label: null }];
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.end;
    }
  }

  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (const m of nonOverlapping) {
    if (m.start > cursor) segments.push({ text: transcript.slice(cursor, m.start), code: null, label: null });
    segments.push({ text: transcript.slice(m.start, m.end), code: m.code, label: m.label });
    cursor = m.end;
  }
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor), code: null, label: null });
  return segments;
}
