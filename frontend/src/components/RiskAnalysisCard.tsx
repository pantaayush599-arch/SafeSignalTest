import { Card, CardHeader, CardBody } from "./ui/Card";
import { RiskBadge } from "./ui/Badge";
import { RiskScale } from "./RiskScale";
import { TranscriptViewer } from "./TranscriptViewer";
import { CallerIdentityCheck } from "./CallerIdentityCheck";
import type { RequestStateOut } from "../api/types";
import { reasonLabel } from "../lib/format";

export function RiskAnalysisCard({ state }: { state: RequestStateOut }) {
  return (
    <Card>
      <CardHeader
        title="Why this was flagged"
        subtitle="Rule-based signal detection. A deepfake/authenticity score, if present, is advisory only."
        right={<RiskBadge level={state.risk_level} />}
      />
      <CardBody>
        <RiskScale score={state.risk_score ?? 0} level={state.risk_level} />

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
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
          <div className="mt-4">
            <TranscriptViewer transcript={state.transcript_or_text} reasonCodes={state.reason_codes} />
          </div>
        )}

        <CallerIdentityCheck state={state} />
      </CardBody>
    </Card>
  );
}
