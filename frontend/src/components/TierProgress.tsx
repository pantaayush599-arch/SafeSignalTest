import { Check, KeyRound } from "lucide-react";
import type { VerificationSummary } from "../api/types";

const TIER_META: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Tier 1", subtitle: "Trusted contact" },
  2: { title: "Tier 2", subtitle: "Escalation contact" },
  3: { title: "Tier 3", subtitle: "One-time challenge" },
};

function tierDotStyle(status: VerificationSummary["status"] | "future") {
  switch (status) {
    case "CONFIRMED":
      return { bg: "var(--color-success)", border: "var(--color-success)", pulse: false };
    case "PENDING":
      return { bg: "transparent", border: "var(--color-cyan)", pulse: true };
    case "REJECTED":
    case "TIMED_OUT":
      return { bg: "var(--color-risk-high)", border: "var(--color-risk-high)", pulse: false };
    default:
      return { bg: "transparent", border: "var(--color-border-strong)", pulse: false };
  }
}

/**
 * Vertical Tier 1 -> Tier 2 -> Tier 3 progress (task spec section 19). The
 * active tier gets a subtle pulse; a tier that hasn't started yet is a
 * plain outline circle, never implying it already happened.
 */
export function TierProgress({ verifications }: { verifications: VerificationSummary[] }) {
  const byTier = new Map(verifications.map((v) => [v.tier, v]));
  const highestReached = verifications.length > 0 ? Math.max(...verifications.map((v) => v.tier)) : 0;

  return (
    <div className="flex flex-col">
      {[1, 2, 3].map((tier, idx) => {
        const v = byTier.get(tier);
        const status = v?.status ?? (tier <= highestReached ? "PENDING" : "future");
        const dot = tierDotStyle(status as VerificationSummary["status"] | "future");
        const meta = TIER_META[tier];
        const reached = Boolean(v) || tier <= highestReached;

        return (
          <div key={tier} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
                style={{ borderColor: dot.border, background: dot.bg }}
              >
                {dot.pulse && (
                  <span className="ss-pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: dot.border }} aria-hidden="true" />
                )}
                {status === "CONFIRMED" && <Check className="h-4 w-4 text-white" />}
                {tier === 3 && status !== "CONFIRMED" && (
                  <KeyRound className="h-3.5 w-3.5" style={{ color: reached ? dot.border : "var(--color-text-faint)" }} />
                )}
              </span>
              {idx < 2 && <span className="my-0.5 h-8 w-px" style={{ background: "var(--color-border-strong)" }} aria-hidden="true" />}
            </div>
            <div className={`pb-6 ${!reached ? "opacity-45" : ""}`}>
              <p className="text-sm font-bold">{meta.title}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{meta.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
