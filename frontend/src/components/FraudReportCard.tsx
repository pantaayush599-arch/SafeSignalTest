import { useState } from "react";
import { Flag, Check } from "lucide-react";
import { Card, CardBody } from "./ui/Card";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { reportScamNumber } from "../api/client";
import { describeError } from "../lib/errors";

/**
 * One-tap fraud reporting (team scope: HIGH priority). Shown once a
 * request has landed on STAYS-PAUSED/TIMED-OUT -- i.e. the system (or the
 * user, via a Tier rejection) treated this as a likely scam.
 *
 * When the request carried a caller phone number, also offers reporting
 * it into SafeSignal's own crowd-reported scam-number database (a
 * self-contained community-reports table -- see app/routers/scam_reports.py)
 * so future requests carrying that same number are flagged for other
 * families, not just external government reporting.
 */
export function FraudReportCard({
  token,
  requestId,
  phoneNumber,
}: {
  token?: string;
  requestId?: string;
  phoneNumber?: string | null;
}) {
  const [reported, setReported] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  async function handleReport() {
    if (!token || !phoneNumber || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportScamNumber(token, { phone_number: phoneNumber, request_id: requestId });
      setReported(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-red-900/40">
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </div>

        {phoneNumber && token && (
          <div className="flex flex-col items-start gap-2 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              Also warn other SafeSignal families about <span className="font-mono">{phoneNumber}</span>.
            </p>
            {reported ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
                <Check className="h-3.5 w-3.5" /> Reported to the community
              </span>
            ) : (
              <Button variant="secondary" icon={<Flag className="h-3.5 w-3.5" />} loading={submitting} onClick={handleReport}>
                Report this number
              </Button>
            )}
          </div>
        )}
        {error && <ErrorBanner title={error.title} message={error.message} />}
      </CardBody>
    </Card>
  );
}
