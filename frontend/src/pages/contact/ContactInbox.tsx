import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState, ErrorBanner, Spinner } from "../../components/ui/Feedback";
import { VerificationStatusBadge, RiskBadge } from "../../components/ui/Badge";
import { Countdown } from "../../components/ui/Countdown";
import { useIdentity } from "../../state/identity";
import { getContactInbox } from "../../api/client";
import type { ContactInboxItem } from "../../api/types";
import { describeError } from "../../lib/errors";
import { formatCurrency } from "../../lib/format";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const TIER_TITLE: Record<number, string> = { 1: "Tier 1 request", 2: "Tier 2 escalation", 3: "Tier 3 code relay" };

export function ContactInbox() {
  useDocumentTitle("Verification inbox");
  const { identity } = useIdentity();
  const [items, setItems] = useState<ContactInboxItem[] | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const load = useCallback(() => {
    if (!identity) return;
    getContactInbox(identity.token, identity.id)
      .then(setItems)
      .catch((e) => setError(describeError(e)));
  }, [identity]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000); // demo-simple polling refresh
    return () => window.clearInterval(id);
  }, [load]);

  if (!identity || identity.role !== "contact") {
    return <ErrorBanner title="No trusted-contact persona selected" message="Go to the home page and pick a trusted-contact persona." />;
  }

  const pending = items?.filter((i) => i.status === "PENDING") ?? [];
  const resolved = items?.filter((i) => i.status !== "PENDING") ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Verification inbox</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Requests asking you to independently confirm whether someone's identity claim is genuine.
        </p>
      </div>

      {error && <ErrorBanner title={error.title} message={error.message} />}
      {!items && !error && <Spinner label="Loading inbox…" />}

      {items && pending.length === 0 && (
        <EmptyState
          icon="✅"
          title="No pending verification requests"
          message="You're all caught up. New requests will appear here as soon as they come in."
        />
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          {pending.map((item) => (
            <Link key={item.verification_id} to={`/contact/verifications/${item.verification_id}`}>
              <Card className="border-[var(--color-status-paused)]/50 transition-colors hover:border-[var(--color-gold)]">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {TIER_TITLE[item.tier] ?? `Tier ${item.tier}`}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold">
                        Claiming to be: {item.claimed_identity ?? "unknown"}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <RiskBadge level={item.risk_level} />
                      <Countdown expiresAt={item.expires_at} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Past requests</h2>
          <div className="flex flex-col gap-2">
            {resolved.map((item) => (
              <Link key={item.verification_id} to={`/contact/verifications/${item.verification_id}`}>
                <Card className="opacity-80 transition-opacity hover:opacity-100">
                  <CardBody className="flex items-center justify-between py-3">
                    <p className="truncate text-sm">
                      {TIER_TITLE[item.tier] ?? `Tier ${item.tier}`} · {item.claimed_identity ?? "unknown"}
                    </p>
                    <VerificationStatusBadge status={item.status} />
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
