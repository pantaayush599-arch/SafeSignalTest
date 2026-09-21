// A lightweight, localStorage-backed history of request IDs the current
// requester persona has created in this browser, purely for the demo's
// navigation convenience -- the backend is the source of truth for state.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/Feedback";
import { useIdentity } from "../../state/identity";
import { getRequestState } from "../../api/client";
import { RequestStatusBadge, RiskBadge } from "../../components/ui/Badge";
import type { RequestStateOut } from "../../api/types";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function requestHistoryKey(requesterId: string) {
  return `safesignal.history.${requesterId}`;
}

export function recordRequestId(requesterId: string, requestId: string) {
  try {
    const key = requestHistoryKey(requesterId);
    const existing: string[] = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!existing.includes(requestId)) {
      window.localStorage.setItem(key, JSON.stringify([requestId, ...existing].slice(0, 20)));
    }
  } catch {
    /* best-effort only */
  }
}

export function RequestHistory() {
  useDocumentTitle("My requests");
  const { identity } = useIdentity();
  const [items, setItems] = useState<RequestStateOut[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!identity) return;
    let ids: string[] = [];
    try {
      ids = JSON.parse(window.localStorage.getItem(requestHistoryKey(identity.id)) || "[]");
    } catch {
      ids = [];
    }
    Promise.all(ids.map((id) => getRequestState(identity.token, id).catch(() => null))).then((results) => {
      setItems(results.filter((r): r is RequestStateOut => r !== null));
      setLoaded(true);
    });
  }, [identity]);

  if (!identity || identity.role !== "requester") return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-bold">My requests</h1>
      {!loaded && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
      {loaded && items.length === 0 && (
        <EmptyState
          icon="📄"
          title="No requests yet"
          message="Requests you analyze will show up here so you can follow their verification progress."
        />
      )}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <Link key={item.request_id} to={`/requester/requests/${item.request_id}`}>
            <Card className="transition-colors hover:border-[var(--color-border-strong)]">
              <CardBody className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.request_id}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{item.transcript_or_text || "Audio request"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <RiskBadge level={item.risk_level} />
                  <RequestStatusBadge status={item.request_status} />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
