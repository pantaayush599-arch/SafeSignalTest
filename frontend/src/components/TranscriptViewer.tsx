import { highlightTranscript } from "../lib/highlightSignals";

const CODE_COLOR: Record<string, string> = {
  money_request: "var(--color-gold)",
  unusual_amount_flag: "var(--color-gold)",
  credential_otp_request: "var(--color-cyan)",
  emergency_claim: "var(--color-risk-high)",
  secrecy_request: "var(--color-risk-high)",
  urgency_keyword: "var(--color-gold)",
  deepfake_signal_advisory: "var(--color-cyan)",
  manual_panic_trigger: "var(--color-gold)",
};

/**
 * Shows the transcript with the actual phrases that triggered each
 * detected signal highlighted inline, plus a short legend beneath mapping
 * phrase -> signal (task spec section 10's literal example format). Only
 * highlights signals present in `reasonCodes` -- never invents one.
 */
export function TranscriptViewer({ transcript, reasonCodes }: { transcript: string; reasonCodes: string[] }) {
  const segments = highlightTranscript(transcript, reasonCodes);
  const legend: { text: string; label: string; code: string }[] = [];
  for (const seg of segments) {
    if (seg.code && seg.label && !legend.some((l) => l.code === seg.code)) {
      legend.push({ text: seg.text.trim(), label: seg.label, code: seg.code });
    }
  }

  return (
    <div className="rounded-lg bg-[var(--color-surface-raised)] p-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Transcript</p>
      <p className="text-sm italic leading-relaxed text-[var(--color-text)]">
        “
        {segments.map((seg, i) =>
          seg.code ? (
            <mark
              key={i}
              className="rounded px-0.5 not-italic font-semibold"
              style={{ background: `color-mix(in srgb, ${CODE_COLOR[seg.code] ?? "var(--color-gold)"} 22%, transparent)`, color: "var(--color-text)" }}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
        ”
      </p>

      {legend.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
          {legend.map((item) => (
            <li key={item.code} className="flex items-center gap-2 text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CODE_COLOR[item.code] ?? "var(--color-gold)" }} aria-hidden="true" />
              <span className="font-mono font-semibold text-[var(--color-text)]">{item.text}</span>
              <span className="text-[var(--color-text-faint)]">→</span>
              <span className="font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
