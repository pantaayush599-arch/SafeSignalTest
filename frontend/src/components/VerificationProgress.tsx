import { useState } from "react";
import { Card, CardHeader, CardBody } from "./ui/Card";
import { Countdown } from "./ui/Countdown";
import { Button } from "./ui/Button";
import { ErrorBanner, SuccessBanner } from "./ui/Feedback";
import { TierProgress } from "./TierProgress";
import { TwoPhoneVerification } from "./TwoPhoneVerification";
import { describeError } from "../lib/errors";
import { submitTier3 } from "../api/client";
import type { RequestStateOut } from "../api/types";

const TIER_SUBTITLE: Record<number, string> = { 1: "Primary contact", 2: "Secondary contact", 3: "Relayed code" };

export function VerificationProgress({
  state,
  token,
  onChanged,
}: {
  state: RequestStateOut;
  token: string;
  onChanged: () => void;
}) {
  const pendingTier12 = state.verifications.find((v) => (v.tier === 1 || v.tier === 2) && v.status === "PENDING");
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
      <CardHeader title="Independent verification" subtitle="Verified through a channel the caller does not control." />
      <CardBody className="flex flex-col gap-5 pt-0 sm:flex-row sm:gap-8">
        <div className="shrink-0">
          <TierProgress verifications={state.verifications} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {pendingTier12 && (
            <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4">
              <TwoPhoneVerification
                contactName={TIER_SUBTITLE[pendingTier12.tier]}
                state="waiting"
                statusText="Waiting for independent confirmation…"
              />
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
                Expires in <Countdown expiresAt={pendingTier12.expires_at} />
              </div>
            </div>
          )}

          {tier3 && (
            <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-4">
              <p className="mb-1 text-sm font-semibold">Enter the one-time code</p>
              <p className="mb-3 text-xs text-[var(--color-text-muted)]">
                Your trusted contact has a fresh single-use code for this request only. Confirm your identity with them
                through another channel (a phone call), then enter what they give you here.
                {attemptsLeft !== null && ` ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`}
              </p>
              <div className="mb-3 flex justify-center">
                <Countdown expiresAt={tier3.expires_at} />
              </div>
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
                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 font-mono text-lg tracking-[0.3em] outline-none focus:border-[var(--color-gold)]"
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

          {!pendingTier12 && !tier3 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {state.request_status === "VERIFIED" ? "Verification complete." : "No verification currently in progress."}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
