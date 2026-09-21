import { useEffect, useState } from "react";
import { Card, CardBody } from "./ui/Card";
import { Spinner, ErrorBanner, EmptyState } from "./ui/Feedback";
import { getAuditTrail } from "../api/client";
import type { AuditEventOut } from "../api/types";
import { describeError } from "../lib/errors";
import { eventLabel, formatDateTime } from "../lib/format";

export function AuditTrail({ token, requestId, refreshKey }: { token: string; requestId: string; refreshKey: unknown }) {
  const [events, setEvents] = useState<AuditEventOut[] | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAuditTrail(token, requestId)
      .then((r) => !cancelled && setEvents(r.events))
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, requestId, open, refreshKey]);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-semibold">Audit trail</span>
        <span className="text-sm text-[var(--color-text-muted)]">{open ? "Hide" : "Why was this allowed / still paused?"}</span>
      </button>
      {open && (
        <CardBody className="border-t border-[var(--color-border)] pt-4">
          {error && <ErrorBanner title={error.title} message={error.message} />}
          {!error && events === null && <Spinner label="Loading audit trail…" />}
          {events && events.length === 0 && (
            <EmptyState title="No audit events" message="Nothing has been recorded for this request yet." />
          )}
          {events && events.length > 0 && (
            <ol className="flex flex-col gap-3">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
                  <div>
                    <span className="font-medium">{eventLabel(e.event)}</span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">{formatDateTime(e.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      )}
    </Card>
  );
}
