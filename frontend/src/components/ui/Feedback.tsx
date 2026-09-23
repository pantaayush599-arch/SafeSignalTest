import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ErrorBanner({ title, message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-[var(--color-danger)]/35 bg-[var(--color-danger-bg)] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden="true" />
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold text-[var(--color-danger)]">{title}</p>}
          <p className="mt-0.5 text-sm text-[var(--color-text)]/90">{message}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function SuccessBanner({ title, message }: { title?: string; message: string }) {
  return (
    <div role="status" className="rounded-lg border border-[var(--color-success)]/35 bg-[var(--color-success-bg)] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold text-[var(--color-success)]">{title}</p>}
          <p className="mt-0.5 text-sm text-[var(--color-text)]/90">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center">
      {icon && <div className="mb-1 text-3xl opacity-60" aria-hidden="true">{icon}</div>}
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-muted)]" role="status" aria-live="polite">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}
