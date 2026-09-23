import { ShieldCheck, ShieldAlert, Lock, RadioTower } from "lucide-react";
import type { SecurityState } from "../state/securityState";

const CONTENT: Record<SecurityState, { icon: typeof ShieldCheck; color: string; title: string; subtitle: string }> = {
  calm: { icon: ShieldCheck, color: "var(--color-cyan)", title: "You're protected", subtitle: "Protection active" },
  risk: { icon: ShieldAlert, color: "var(--color-risk-high)", title: "Risk detected", subtitle: "Analyzing the request" },
  paused: { icon: Lock, color: "var(--color-gold)", title: "Action paused", subtitle: "Independent verification required" },
  verifying: { icon: RadioTower, color: "var(--color-cyan)", title: "Verifying", subtitle: "Waiting for your trusted contact" },
  verified: { icon: ShieldCheck, color: "var(--color-success)", title: "Verified", subtitle: "Action unlocked" },
};

/**
 * Refined, non-3D animated status visualization for Home (task spec
 * section 9: "Use a refined animated security-status visualization," not a
 * giant 3D shield). Ring pulse communicates the same state the background
 * reflects, at the one spot users look first.
 */
export function SecurityStatusHero({ state = "calm" }: { state?: SecurityState }) {
  const { icon: Icon, color, title, subtitle } = CONTENT[state];
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="ss-pulse-ring absolute inset-0 rounded-full border-2" style={{ borderColor: color }} aria-hidden="true" />
        <span
          className="absolute inset-2 rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          aria-hidden="true"
        />
        <span
          className="relative flex h-16 w-16 items-center justify-center rounded-full border"
          style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: "var(--color-surface)" }}
        >
          <Icon className="h-8 w-8" style={{ color }} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xl font-extrabold tracking-tight" style={{ color }}>
        {title.toUpperCase()}
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
    </div>
  );
}
