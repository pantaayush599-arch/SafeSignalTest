import type { RequestStatus, RiskLevel, VerificationStatus } from "../../api/types";

function Badge({
  label,
  dotClassName,
  className = "",
}: {
  label: string;
  dotClassName: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text)] ${className}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <Badge label="Unscored" dotClassName="bg-slate-500" />;
  const map: Record<RiskLevel, { label: string; dot: string }> = {
    LOW: { label: "Low risk", dot: "bg-[var(--color-risk-low)]" },
    MEDIUM: { label: "Medium risk", dot: "bg-[var(--color-risk-medium)]" },
    HIGH: { label: "High risk", dot: "bg-[var(--color-risk-high)]" },
  };
  const m = map[level];
  return <Badge label={m.label} dotClassName={m.dot} />;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { label: string; dot: string }> = {
    PENDING: { label: "Pending", dot: "bg-[var(--color-cyan)]" },
    VERIFIED: { label: "Verified · unlocked", dot: "bg-[var(--color-status-verified)]" },
    "STAYS-PAUSED": { label: "Action paused", dot: "bg-[var(--color-status-paused)] animate-pulse" },
    "TIMED-OUT": { label: "Timed out · still paused", dot: "bg-[var(--color-status-timedout)]" },
    "MANUAL-OVERRIDE": { label: "Manual override", dot: "bg-[var(--color-status-override)]" },
  };
  const m = map[status];
  return <Badge label={m.label} dotClassName={m.dot} />;
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const map: Record<VerificationStatus, { label: string; dot: string }> = {
    PENDING: { label: "Waiting for response", dot: "bg-[var(--color-cyan)] animate-pulse" },
    CONFIRMED: { label: "Confirmed", dot: "bg-[var(--color-status-verified)]" },
    REJECTED: { label: "Rejected", dot: "bg-[var(--color-risk-high)]" },
    TIMED_OUT: { label: "Timed out", dot: "bg-[var(--color-status-timedout)]" },
  };
  const m = map[status];
  return <Badge label={m.label} dotClassName={m.dot} />;
}
