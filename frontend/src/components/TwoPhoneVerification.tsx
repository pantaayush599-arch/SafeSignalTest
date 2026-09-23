import { Smartphone, Check } from "lucide-react";

type SignalState = "waiting" | "verified" | "failed";

function PhoneCard({ label, sublabel, active }: { label: string; sublabel: string; active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-20 w-14 items-center justify-center rounded-xl border-2"
        style={{
          borderColor: active ? "var(--color-cyan)" : "var(--color-border-strong)",
          background: active ? "color-mix(in srgb, var(--color-cyan) 10%, transparent)" : "var(--color-surface-raised)",
        }}
      >
        <Smartphone className="h-6 w-6" style={{ color: active ? "var(--color-cyan)" : "var(--color-text-faint)" }} />
      </div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-[11px] text-[var(--color-text-faint)]">{sublabel}</p>
      </div>
    </div>
  );
}

/**
 * "YOUR PHONE ... TRUSTED CONTACT" animated verification visualization
 * (task spec section 18). The signal visibly travels between the two
 * devices while a tier is pending, and settles once resolved.
 */
export function TwoPhoneVerification({
  contactName,
  state,
  statusText,
}: {
  contactName: string;
  state: SignalState;
  statusText: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative flex w-full max-w-xs items-center justify-between">
        <PhoneCard label="Your phone" sublabel="Requesting" active={state === "waiting"} />
        <div className="relative mx-2 h-px flex-1 self-center" style={{ background: "var(--color-border-strong)" }}>
          {state === "waiting" && (
            <span
              className="ss-signal-dot absolute -top-1 h-2.5 w-2.5 rounded-full"
              style={{ background: "var(--color-cyan)", boxShadow: "0 0 8px var(--color-cyan)" }}
              aria-hidden="true"
            />
          )}
          {state === "verified" && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-success)] p-1" aria-hidden="true">
              <Check className="h-3 w-3 text-white" />
            </span>
          )}
        </div>
        <PhoneCard label="Trusted contact" sublabel={contactName} active={state === "waiting"} />
      </div>

      <p
        className="text-center text-sm font-semibold uppercase tracking-wide"
        style={{
          color: state === "verified" ? "var(--color-success)" : state === "failed" ? "var(--color-risk-high)" : "var(--color-cyan)",
        }}
        aria-live="polite"
      >
        {statusText}
      </p>
    </div>
  );
}
