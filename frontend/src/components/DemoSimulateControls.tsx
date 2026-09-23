import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardHeader, CardBody } from "./ui/Card";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { demoExpireVerification, listTrustedContacts, respondTier1, respondTier2 } from "../api/client";
import { getDemoIdentities } from "../api/client";
import { describeError } from "../lib/errors";
import type { ContactType, VerificationSummary } from "../api/types";

/**
 * Demo-mode convenience only: in real use, a Tier1/2 confirmation comes
 * from the trusted contact's OWN device and login, on a channel the caller
 * doesn't control. This prototype has no second device available, so this
 * panel lets the requester simulate that independent response using the
 * seeded contact's real demo token and the REAL verification endpoints --
 * it never fabricates an outcome client-side; every action here is a
 * genuine authenticated call that the backend processes exactly as it
 * would from the contact's own session.
 */
export function DemoSimulateControls({
  requesterToken,
  requesterId,
  verification,
  onChanged,
}: {
  requesterToken: string;
  requesterId: string;
  verification: VerificationSummary;
  onChanged: () => void;
}) {
  const [contactName, setContactName] = useState<string | null>(null);
  const [contactToken, setContactToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"confirm" | "reject" | "timeout" | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const neededType: ContactType = verification.tier === 1 ? "PRIMARY" : "SECONDARY";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([listTrustedContacts(requesterToken, requesterId), getDemoIdentities()])
      .then(([contacts, identities]) => {
        if (cancelled) return;
        const contact = contacts.find((c) => c.contact_type === neededType);
        if (!contact) {
          setContactName(null);
          setContactToken(null);
          return;
        }
        const identity = identities.find((i) => i.role === "contact" && i.id === contact.contact_id);
        setContactName(contact.contact_name);
        setContactToken(identity?.token ?? null);
      })
      .catch((err) => !cancelled && setError(describeError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requesterToken, requesterId, verification.tier]);

  async function handleRespond(response: "CONFIRMED" | "REJECTED") {
    if (!contactToken) return;
    setBusy(response === "CONFIRMED" ? "confirm" : "reject");
    setError(null);
    try {
      const respond = verification.tier === 1 ? respondTier1 : respondTier2;
      await respond(contactToken, verification.verification_id, response);
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleTimeout() {
    setBusy("timeout");
    setError(null);
    try {
      await demoExpireVerification(requesterToken, verification.verification_id);
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-dashed border-[var(--color-cyan)]/40 bg-[var(--color-info-bg)]">
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[var(--color-cyan)]" /> Demo mode
          </span>
        }
        subtitle={
          contactName
            ? `Simulate ${contactName}'s response as Tier ${verification.tier}, using their real demo login.`
            : `No Tier ${verification.tier} trusted contact is set up for this family yet.`
        }
      />
      <CardBody className="flex flex-col gap-3">
        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Looking up the demo contact…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="confirm"
              icon={<CheckCircle2 className="h-4 w-4" />}
              disabled={!contactToken}
              loading={busy === "confirm"}
              onClick={() => handleRespond("CONFIRMED")}
            >
              Simulate confirm
            </Button>
            <Button
              variant="reject"
              icon={<XCircle className="h-4 w-4" />}
              disabled={!contactToken}
              loading={busy === "reject"}
              onClick={() => handleRespond("REJECTED")}
            >
              Simulate reject
            </Button>
            <Button variant="secondary" icon={<Clock className="h-4 w-4" />} loading={busy === "timeout"} onClick={handleTimeout}>
              Simulate timeout
            </Button>
          </div>
        )}
        {error && <ErrorBanner title={error.title} message={error.message} />}
      </CardBody>
    </Card>
  );
}
