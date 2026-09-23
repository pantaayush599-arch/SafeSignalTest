import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody } from "./ui/Card";
import { EmptyState, ErrorBanner, Spinner } from "./ui/Feedback";
import { getAuditTrail, getDashboard } from "../api/client";
import { getEventVisual } from "../lib/eventIcons";
import { eventLabel } from "../lib/format";
import { describeError } from "../lib/errors";

interface FeedItem {
  event: string;
  timestamp: string;
  requestId: string;
}

function dayGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function FeedRow({ item, linkable }: { item: FeedItem; linkable: boolean }) {
  const { icon: Icon, color } = getEventVisual(item.event);
  const content = (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{eventLabel(item.event)}</p>
        <p className="text-xs text-[var(--color-text-faint)]">
          {new Date(item.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {item.requestId}
        </p>
      </div>
    </div>
  );
  return linkable ? (
    <Link to={`/requester/requests/${item.requestId}`} className="block hover:bg-[var(--color-surface-raised)]">
      {content}
    </Link>
  ) : (
    <div>{content}</div>
  );
}

/**
 * Merges every request's audit trail for a requester into one
 * chronological "security history" feed grouped by day (task spec section
 * 22), rather than a per-request analytics table. Also powers Home's
 * "recent protection" preview via `limit` + `grouped=false`.
 */
export function ActivityFeed({
  token,
  requesterId,
  linkable,
  limit,
  grouped = true,
}: {
  token: string;
  requesterId: string;
  linkable: boolean;
  limit?: number;
  grouped?: boolean;
}) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dashboard = await getDashboard(token, requesterId);
        const trails = await Promise.all(
          dashboard.entries.map((e) => getAuditTrail(token, e.request_id).catch(() => null))
        );
        if (cancelled) return;
        const merged: FeedItem[] = [];
        trails.forEach((trail, i) => {
          if (!trail) return;
          const requestId = dashboard.entries[i].request_id;
          for (const ev of trail.events) {
            merged.push({ event: ev.event, timestamp: ev.timestamp, requestId });
          }
        });
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setItems(merged);
      } catch (err) {
        if (!cancelled) setError(describeError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, requesterId]);

  if (error) return <ErrorBanner title={error.title} message={error.message} />;
  if (!items) return <Spinner label="Loading activity…" />;
  if (items.length === 0) {
    return <EmptyState title="No activity yet" message="Protection events will show up here as soon as something is detected." />;
  }

  const shown = limit ? items.slice(0, limit) : items;

  if (!grouped) {
    return (
      <Card>
        <CardBody className="divide-y divide-[var(--color-border)] p-0">
          {shown.map((item, i) => (
            <FeedRow key={i} item={item} linkable={linkable} />
          ))}
        </CardBody>
      </Card>
    );
  }

  const groups: { label: string; items: FeedItem[] }[] = [];
  for (const item of shown) {
    const label = dayGroupLabel(item.timestamp);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-faint)]">{group.label}</p>
          <Card>
            <CardBody className="divide-y divide-[var(--color-border)] p-0">
              {group.items.map((item, i) => (
                <FeedRow key={i} item={item} linkable={linkable} />
              ))}
            </CardBody>
          </Card>
        </div>
      ))}
    </div>
  );
}
