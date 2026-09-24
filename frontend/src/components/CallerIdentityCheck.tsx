import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { RequestStateOut } from "../api/types";

/**
 * Surfaces the two context checks that only run when a caller phone number
 * was supplied (app.context_checks on the backend): whether it matches a
 * trusted contact's registered number for the identity being claimed, and
 * whether the community has reported it as a scam number. Renders nothing
 * beyond what the backend actually computed -- no assumed match, no
 * assumed clean number.
 */
export function CallerIdentityCheck({ state }: { state: RequestStateOut }) {
  if (!state.known_contact_checked && !state.caller_phone_number) return null;

  const rows: { icon: typeof ShieldCheck; tone: "good" | "bad" | "neutral"; text: string }[] = [];

  if (state.known_contact_checked) {
    if (state.known_contact_match === true) {
      rows.push({
        icon: ShieldCheck,
        tone: "good",
        text: `Caller number matches ${state.known_contact_name}'s registered contact.`,
      });
    } else if (state.known_contact_match === false) {
      rows.push({
        icon: ShieldAlert,
        tone: "bad",
        text: `Claims to be "${state.claimed_identity}", but this number doesn't match ${state.known_contact_name}'s registered contact.`,
      });
    } else {
      rows.push({
        icon: ShieldQuestion,
        tone: "neutral",
        text: `"${state.claimed_identity}" isn't the relationship of any trusted contact on file, so it can't be cross-checked.`,
      });
    }
  }

  if (state.caller_phone_number) {
    if (state.reported_scam_number) {
      rows.push({
        icon: ShieldAlert,
        tone: "bad",
        text: `This number has been reported as a scam ${state.scam_report_count} time${state.scam_report_count === 1 ? "" : "s"} by the community.`,
      });
    } else {
      rows.push({ icon: ShieldCheck, tone: "good", text: "No community scam reports for this number." });
    }
  }

  const toneClasses: Record<string, string> = {
    good: "text-[var(--color-success)]",
    bad: "text-[var(--color-danger)]",
    neutral: "text-[var(--color-text-muted)]",
  };

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3.5 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Caller identity check</p>
      {rows.map((row, i) => {
        const Icon = row.icon;
        return (
          <div key={i} className={`flex items-start gap-2 text-sm ${toneClasses[row.tone]}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{row.text}</span>
          </div>
        );
      })}
    </div>
  );
}
