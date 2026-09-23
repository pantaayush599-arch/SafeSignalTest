import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { describeError } from "../lib/errors";

const REASON_MAX = 500;

export function ManualOverrideModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [step, setStep] = useState<"warn" | "reason">("warn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [touched, setTouched] = useState(false);

  function reset() {
    setReason("");
    setAcknowledged(false);
    setStep("warn");
    setError(null);
    setSubmitting(false);
    setTouched(false);
  }

  function close() {
    reset();
    onClose();
  }

  const reasonEmpty = reason.trim().length === 0;

  async function handleConfirm() {
    setTouched(true);
    if (reasonEmpty || !acknowledged) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      close();
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Manual override">
      {step === "warn" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-danger)]/35 bg-[var(--color-danger-bg)] px-4 py-3.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />
            <p className="text-sm leading-relaxed text-[var(--color-text)]/90">
              Manual override will bypass the normal verification protection. Only use this if you've personally
              confirmed the request is genuine through another channel. This is permanently logged.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setStep("reason")}>
              I understand, continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label htmlFor="override-reason" className="text-sm">
            <span className="mb-1.5 block font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Reason for override
            </span>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              onBlur={() => setTouched(true)}
              rows={4}
              autoFocus
              maxLength={REASON_MAX}
              placeholder="Explain why you need to proceed without independent verification…"
              aria-invalid={touched && reasonEmpty}
              aria-describedby="override-reason-help"
              className={`w-full resize-y rounded-lg border bg-[var(--color-surface-raised)] px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors ${
                touched && reasonEmpty
                  ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]"
                  : "border-[var(--color-border-strong)] focus:border-[var(--color-gold)]"
              }`}
            />
            <div id="override-reason-help" className="mt-1 flex items-center justify-between text-xs">
              {touched && reasonEmpty ? (
                <span className="text-[var(--color-danger)]">A reason is required to proceed.</span>
              ) : (
                <span className="text-[var(--color-text-faint)]">Be specific — this becomes part of the permanent record.</span>
              )}
              <span className="shrink-0 text-[var(--color-text-faint)]">{reason.length}/{REASON_MAX}</span>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border-strong)] accent-[var(--color-gold)]"
            />
            <span className="text-[var(--color-text)]/90">
              I understand that proceeding without verification may expose me to risk.
            </span>
          </label>

          {error && <ErrorBanner title={error.title} message={error.message} />}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirm} loading={submitting} disabled={reasonEmpty || !acknowledged}>
              Continue with manual override
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
