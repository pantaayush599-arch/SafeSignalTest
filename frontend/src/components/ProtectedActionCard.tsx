import { Lock, LockOpen, AlertTriangle, Eye, Clock } from "lucide-react";
import { Card, CardHeader, CardBody } from "./ui/Card";
import type { RequestStateOut } from "../api/types";
import { deriveProtectedAction } from "../lib/protectedAction";

/**
 * The protected-action screen (task spec section 14/31): title and body
 * are derived from the actual detected context (deriveProtectedAction) --
 * never a fabricated "Transfer" when the request carried no amount.
 */
export function ProtectedActionCard({ state }: { state: RequestStateOut }) {
  const action = deriveProtectedAction(state);
  const locked = state.request_status === "STAYS-PAUSED" || state.request_status === "TIMED-OUT";
  const unlocked = state.request_status === "VERIFIED";
  const overridden = state.request_status === "MANUAL-OVERRIDE";
  const advisory = state.request_status === "PENDING" && state.decision === "REVIEW";

  let statusText: string;
  let statusColor: string;
  let ring: string;
  let Icon = Lock;

  if (unlocked) {
    statusText = "Unlocked";
    statusColor = "var(--color-success)";
    ring = "var(--color-success)";
    Icon = LockOpen;
  } else if (overridden) {
    statusText = "Manually overridden";
    statusColor = "var(--color-gold)";
    ring = "var(--color-gold)";
    Icon = AlertTriangle;
  } else if (state.request_status === "TIMED-OUT") {
    statusText = "Remains paused — timed out";
    statusColor = "var(--color-status-timedout)";
    ring = "var(--color-border-strong)";
    Icon = Clock;
  } else if (advisory) {
    statusText = "Not locked — review before proceeding";
    statusColor = "var(--color-cyan)";
    ring = "var(--color-cyan)";
    Icon = Eye;
  } else if (locked) {
    statusText = "Action paused";
    statusColor = "var(--color-gold)";
    ring = "var(--color-gold)";
    Icon = Lock;
  } else {
    statusText = "Awaiting analysis";
    statusColor = "var(--color-text-muted)";
    ring = "var(--color-border)";
    Icon = Lock;
  }

  return (
    <Card style={{ borderColor: `color-mix(in srgb, ${ring} 45%, transparent)`, borderWidth: 2 }}>
      <CardHeader title={action.title} subtitle={action.subtitle} />
      <CardBody>
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full border-2"
            style={{ borderColor: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, transparent)` }}
          >
            <Icon className="h-6 w-6" style={{ color: statusColor }} />
          </span>
          <p className="text-lg font-extrabold uppercase tracking-wide" style={{ color: statusColor }}>
            {statusText}
          </p>
          {locked && !advisory && (
            <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
              This action has been temporarily paused because the request appears high-risk.
            </p>
          )}
          {advisory && (
            <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
              Some risk signals were detected, but not enough to automatically pause the action.
            </p>
          )}
        </div>

        {state.claimed_identity && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <span className="text-sm text-[var(--color-text-muted)]">Claimed identity</span>
            <span className="font-semibold">{state.claimed_identity}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
