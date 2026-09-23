import type { RiskLevel } from "../api/types";
import { RISK_HIGH_MIN, RISK_MEDIUM_MIN } from "../lib/riskBands";

/**
 * LOW —— MEDIUM —— HIGH horizontal scale with a marker at the actual
 * score (task spec section 12: "Do NOT use a speedometer").
 */
export function RiskScale({ score, level }: { score: number; level: RiskLevel | null | undefined }) {
  const clamped = Math.max(0, Math.min(100, score));
  const levelColor: Record<RiskLevel, string> = {
    LOW: "var(--color-risk-low)",
    MEDIUM: "var(--color-risk-medium)",
    HIGH: "var(--color-risk-high)",
  };
  const markerColor = level ? levelColor[level] : "var(--color-text-faint)";

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-extrabold tabular" style={{ color: markerColor }}>
          {score}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">/ 100</span>
        {level && (
          <span className="ml-auto text-sm font-bold uppercase tracking-wide" style={{ color: markerColor }}>
            {level} risk
          </span>
        )}
      </div>

      <div className="relative h-2.5 w-full overflow-visible rounded-full bg-[var(--color-border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${RISK_MEDIUM_MIN}%`,
            background: "var(--color-risk-low)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${RISK_MEDIUM_MIN}%`,
            width: `${RISK_HIGH_MIN - RISK_MEDIUM_MIN}%`,
            background: "var(--color-risk-medium)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: `${RISK_HIGH_MIN}%`,
            width: `${100 - RISK_HIGH_MIN}%`,
            background: "var(--color-risk-high)",
            opacity: 0.35,
          }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-bg)] shadow"
          style={{ left: `${clamped}%`, background: markerColor }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
}
