import { useState } from "react";
import { Card, CardHeader, CardBody } from "./ui/Card";
import { VerificationStatusBadge } from "./ui/Badge";
import { Countdown } from "./ui/Countdown";
import { Button } from "./ui/Button";
import { ErrorBanner, SuccessBanner } from "./ui/Feedback";
import { describeError } from "../lib/errors";
import { submitTier3 } from "../api/client";
import type { RequestStateOut, VerificationSummary } from "../api/types";

const TIER_LABEL: Record<number, { title: string; description: string }> = {
  1: { title: "Tier 1 — Trusted contact", description: "One-time request to your pre-registered primary contact." },
  2: { title: "Tier 2 — Escalation", description: "Secondary contact or known-number callback." },
  3: { title: "Tier 3 — Rotating passphrase", description: "Last resort: single-use code relayed through an independent channel." },
};

function TierRow({ v }: { v: VerificationSummary }) {
  const { title, description } = TIER_LABEL[v.tier] ?? { title: `Tier ${v.tier}`, description: "" };
  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--color-border)] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {v.status === "PENDING" && <Countdown expiresAt={v.expires_at} />}
        <VerificationStatusBadge status={v.status} />
      </div>
    </div>
  );
}

export function VerificationProgress({
  state,
  token,
  onChanged,
}: {
  state: RequestStateOut;
  token: string;
  onChanged: () => void;
}) {
  const tier3 = state.verifications.find((v) => v.tier === 3 && v.status === "PENDING");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!tier3 || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await submitTier3(token, tier3.verification_id, code.trim());
      if (result.status === "CONFIRMED") {
        setSuccess("Code confirmed — action unlocked.");
        setCode("");
        onChanged();
      } else {
        setAttemptsLeft(result.attempts_remaining ?? null);
        setError({
          title: "Incorrect code",
          message:
            result.attempts_remaining && result.attempts_remaining > 0
              ? `That code didn't match. ${result.attempts_remaining} attempt${result.attempts_remaining === 1 ? "" : "s"} remaining.`
              : "That code didn't match and no attempts remain. The request has timed out.",
        });
        onChanged();
      }
    } catch (err) {
      setError(describeError(err));
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }

  if (state.verifications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Independent verification"
        subtitle="Verified through a channel the caller does not control."
      />
      <CardBody className="pt-0">
        <div className="divide-y divide-[var(--color-border)]">
          {state.verifications.map((v) => (
            <TierRow key={v.verification_id} v={v} />
          ))}
        </div>

        {tier3 && (
          <div className="mt-4 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4">
            <p className="mb-1 text-sm font-semibold">Enter the one-time code</p>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Your trusted contact has a fresh single-use code for this request only. Confirm your identity with them
              through another channel (a phone call), then enter what they give you here.
              {attemptsLeft !== null && ` ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`}
            </p>
            <form onSubmit={handleSubmitCode} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="tier3-code" className="sr-only">
                One-time code
              </label>
              <input
                id="tier3-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-lg tracking-[0.3em] outline-none focus:border-[var(--color-brand)]"
              />
              <Button type="submit" loading={submitting} disabled={code.length !== 6}>
                Submit code
              </Button>
            </form>
            {success && (
              <div className="mt-3">
                <SuccessBanner message={success} />
              </div>
            )}
            {error && (
              <div className="mt-3">
                <ErrorBanner title={error.title} message={error.message} />
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
