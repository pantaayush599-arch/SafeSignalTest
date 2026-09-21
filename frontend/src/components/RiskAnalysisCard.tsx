import { Card, CardHeader, CardBody } from "./ui/Card";
import { RiskBadge } from "./ui/Badge";
import type { RequestStateOut } from "../api/types";
import { reasonLabel } from "../lib/format";

export function RiskAnalysisCard({ state }: { state: RequestStateOut }) {
  return (
    <Card>
      <CardHeader
        title="Risk analysis"
        subtitle="Rule-based signal detection. A deepfake/authenticity score, if present, is advisory only."
        right={<RiskBadge level={state.risk_level} />}
      />
      <CardBody>
        <div className="mb-4 flex items-end gap-2">
          <span className="font-mono text-4xl font-extrabold tabular">{state.risk_score ?? 0}</span>
          <span className="mb-1 text-sm text-[var(--color-text-muted)]">/ 100 risk score</span>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Detected signals
        </p>
        {state.reason_codes.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No risk signals detected.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {state.reason_codes.map((code) => (
              <li
                key={code}
                className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-1 text-xs font-medium"
              >
                {reasonLabel(code)}
              </li>
            ))}
          </ul>
        )}

        {state.transcript_or_text && (
          <div className="mt-4 rounded-lg bg-[var(--color-surface-raised)] p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Transcript</p>
            <p className="text-sm italic text-[var(--color-text)]">“{state.transcript_or_text}”</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
