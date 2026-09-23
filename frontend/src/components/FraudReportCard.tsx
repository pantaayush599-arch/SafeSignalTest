import { Card, CardBody } from "./ui/Card";

/**
 * One-tap fraud reporting (team scope: HIGH priority). Shown once a
 * request has landed on STAYS-PAUSED/TIMED-OUT -- i.e. the system (or the
 * user, via a Tier rejection) treated this as a likely scam.
 */
export function FraudReportCard() {
  return (
    <Card className="border-red-900/40">
      <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Think this was a scam attempt?</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Report it to India's National Cyber Crime Reporting Portal, or call the helpline directly.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href="tel:1930"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--color-border-strong)]"
          >
            Call 1930
          </a>
          <a
            href="https://cybercrime.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Report at cybercrime.gov.in
          </a>
        </div>
      </CardBody>
    </Card>
  );
}
