import { Card, CardHeader, CardBody } from "./ui/Card";
import type { RequestStateOut } from "../api/types";
import { formatCurrency } from "../lib/format";

export function ProtectedActionCard({ state }: { state: RequestStateOut }) {
  const locked = state.request_status === "STAYS-PAUSED" || state.request_status === "TIMED-OUT";
  const unlocked = state.request_status === "VERIFIED";
  const overridden = state.request_status === "MANUAL-OVERRIDE";

  let statusText: string;
  let statusClass: string;
  let ring: string;
  if (unlocked) {
    statusText = "Unlocked — transfer allowed";
    statusClass = "text-[var(--color-status-verified)]";
    ring = "border-emerald-800/60";
  } else if (overridden) {
    statusText = "Manually overridden — sent outside normal verification";
    statusClass = "text-[var(--color-status-override)]";
    ring = "border-purple-800/60";
  } else if (state.request_status === "TIMED-OUT") {
    statusText = "Timed out — remains locked";
    statusClass = "text-[var(--color-status-timedout)]";
    ring = "border-slate-700";
  } else {
    statusText = "Locked — high-risk request detected";
    statusClass = "text-[var(--color-status-paused)]";
    ring = "border-amber-800/60";
  }

  return (
    <Card className={`border-2 ${ring}`}>
      <CardHeader title="UPI / Wallet transfer" subtitle="Simulated — no real funds move in this prototype." />
      <CardBody>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <span className="text-sm text-[var(--color-text-muted)]">Recipient (claimed)</span>
          <span className="font-semibold">{state.claimed_identity ?? "Unknown"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] py-3">
          <span className="text-sm text-[var(--color-text-muted)]">Amount</span>
          <span className="font-mono text-lg font-bold tabular">{formatCurrency(state.amount)}</span>
        </div>
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm text-[var(--color-text-muted)]">Status</span>
          <span className={`flex items-center gap-2 font-semibold ${statusClass}`}>
            {locked && (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {unlocked && (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="2" />
                <path d="M8 11V8a4 4 0 0 1 7.4-2.1" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {statusText}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
