import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState, ErrorBanner, Spinner } from "../components/ui/Feedback";
import { RequestStatusBadge, RiskBadge } from "../components/ui/Badge";
import { useIdentity } from "../state/identity";
import { getDashboard } from "../api/client";
import type { DashboardOut } from "../api/types";
import { describeError } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * Simple family dashboard (team scope: MEDIUM-HIGH priority, "a simple
 * read/view dashboard, NOT a large analytics system"). Read-only view over
 * GET /requesters/{id}/dashboard -- no new backend logic beyond what that
 * endpoint already aggregates.
 */
export function FamilyDashboard() {
  const { requesterId } = useParams<{ requesterId: string }>();
  useDocumentTitle("Family dashboard");
  const { identity } = useIdentity();
  const [data, setData] = useState<DashboardOut | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!identity || !requesterId) return;
    getDashboard(identity.token, requesterId)
      .then(setData)
      .catch((e) => setError(describeError(e)));
  }, [identity, requesterId]);

  if (!identity) {
    return <ErrorBanner title="Sign in required" message="Pick a persona to view the family dashboard." />;
  }
  if (error) return <ErrorBanner title={error.title} message={error.message} />;
  if (!data) return <Spinner label="Loading family dashboard…" />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Family protection</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Recent flagged requests and their outcomes for {data.requester_name}'s account.
        </p>
      </div>

      <Card>
        <CardHeader title="Recent events" />
        {data.entries.length === 0 ? (
          <CardBody>
            <EmptyState
              icon="🛡️"
              title="No flagged requests yet"
              message="Requests that get analyzed will show up here with their risk level and outcome."
            />
          </CardBody>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {data.entries.map((e) => (
              <Link
                key={e.request_id}
                to={identity.role === "requester" ? `/requester/requests/${e.request_id}` : "#"}
                className={identity.role === "requester" ? "" : "pointer-events-none"}
              >
                <div className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {e.triggered_by_panic ? "🚨 Panic-triggered request" : `Claiming to be: ${e.claimed_identity ?? "unknown"}`}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatCurrency(e.amount)} · {formatDateTime(e.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RiskBadge level={e.risk_level} />
                    <RequestStatusBadge status={e.request_status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
