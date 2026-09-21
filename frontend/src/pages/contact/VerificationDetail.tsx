import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardHeader, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ErrorBanner, Spinner, SuccessBanner } from "../../components/ui/Feedback";
import { VerificationStatusBadge, RiskBadge } from "../../components/ui/Badge";
import { Countdown } from "../../components/ui/Countdown";
import { useIdentity } from "../../state/identity";
import { getContactInbox, respondTier1, respondTier2 } from "../../api/client";
import type { ContactInboxItem } from "../../api/types";
import { describeError } from "../../lib/errors";
import { formatCurrency, reasonLabel } from "../../lib/format";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function VerificationDetail() {
  useDocumentTitle("Verification request");
  const { verificationId } = useParams<{ verificationId: string }>();
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContactInboxItem | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [responding, setResponding] = useState<"CONFIRMED" | "REJECTED" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!identity) return;
    getContactInbox(identity.token, identity.id)
      .then((items) => {
        const found = items.find((i) => i.verification_id === verificationId);
        if (!found) {
          setError({ title: "Not found", message: "This verification request isn't assigned to you, or no longer exists." });
        } else {
          setItem(found);
        }
      })
      .catch((e) => setError(describeError(e)));
  }, [identity, verificationId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!identity || identity.role !== "contact") {
    return <ErrorBanner title="No trusted-contact persona selected" message="Go to the home page and pick a trusted-contact persona." />;
  }
  if (error && !item) return <ErrorBanner title={error.title} message={error.message} />;
  if (!item) return <Spinner label="Loading verification…" />;

  const isPending = item.status === "PENDING";
  const isTier3 = item.tier === 3;

  async function respond(response: "CONFIRMED" | "REJECTED") {
    if (!identity || !item || responding) return;
    setResponding(response);
    setError(null);
    try {
      const fn = item.tier === 1 ? respondTier1 : respondTier2;
      const result = await fn(identity.token, item.verification_id, response);
      setSuccess(
        response === "CONFIRMED"
          ? "Confirmed. The requester's action has been unlocked."
          : "Rejected. The request stays paused and will escalate."
      );
      setItem({ ...item, status: result.status });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <button onClick={() => navigate("/contact")} className="w-fit text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        ← Back to inbox
      </button>

      <Card>
        <CardHeader
          title={`Verification request · Tier ${item.tier}`}
          subtitle="Sent through a channel the caller does not control."
          right={<VerificationStatusBadge status={item.status} />}
        />
        <CardBody className="flex flex-col gap-4">
          <p className="text-sm">
            Someone is asking to send <span className="font-semibold">{formatCurrency(item.amount)}</span> on behalf of a
            family member claiming to be <span className="font-semibold">{item.claimed_identity ?? "unknown"}</span>. Is
            this genuine?
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={item.risk_level} />
            {item.risk_score !== null && item.risk_score !== undefined && (
              <span className="text-xs text-[var(--color-text-muted)]">Risk score {item.risk_score}/100</span>
            )}
          </div>

          {item.reason_codes.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {item.reason_codes.map((c) => (
                <li key={c} className="rounded-full border border-[var(--color-border-strong)] px-2.5 py-1 text-xs">
                  {reasonLabel(c)}
                </li>
              ))}
            </ul>
          )}

          {item.transcript_or_text && (
            <div className="rounded-lg bg-[var(--color-surface-raised)] p-3 text-sm italic">“{item.transcript_or_text}”</div>
          )}

          {item.escalation_reason && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Escalated because: {item.escalation_reason.replace(/_/g, " ").toLowerCase()}
            </p>
          )}

          {isPending && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm">
              <span className="text-[var(--color-text-muted)]">Expires in</span>
              <Countdown expiresAt={item.expires_at} />
            </div>
          )}
        </CardBody>
      </Card>

      {isTier3 ? (
        <Card>
          <CardHeader title="One-time relay code" subtitle="Share this only after confirming their identity another way (e.g. a phone call)." />
          <CardBody>
            {isPending ? (
              <>
                <p className="mb-3 text-xs text-[var(--color-text-muted)]">
                  DEMO NOTE: in production this code is delivered out-of-band (SMS/voice); this prototype has no
                  telephony integration, so it's shown here directly so the demo is fully operable.
                </p>
                <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] py-4 text-center font-mono text-3xl font-bold tracking-[0.4em]">
                  {item.demo_code}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">This code has already been resolved.</p>
            )}
          </CardBody>
        </Card>
      ) : (
        isPending && (
          <div className="flex gap-3">
            <Button variant="confirm" fullWidth loading={responding === "CONFIRMED"} disabled={!!responding} onClick={() => respond("CONFIRMED")}>
              Confirm — this is genuine
            </Button>
            <Button variant="reject" fullWidth loading={responding === "REJECTED"} disabled={!!responding} onClick={() => respond("REJECTED")}>
              Reject
            </Button>
          </div>
        )
      )}

      {success && <SuccessBanner message={success} />}
      {error && item && <ErrorBanner title={error.title} message={error.message} />}
    </div>
  );
}
