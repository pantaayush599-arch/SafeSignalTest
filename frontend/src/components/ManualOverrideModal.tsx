import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { describeError } from "../lib/errors";

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
  const [step, setStep] = useState<"warn" | "reason">("warn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  function reset() {
    setReason("");
    setStep("warn");
    setError(null);
    setSubmitting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleConfirm() {
    if (!reason.trim()) {
      setError({ title: "Reason required", message: "Explain how you verified this is a genuine emergency." });
      return;
    }
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
          <ErrorBanner
            title="This bypasses independent verification"
            message="Manual override skips the trusted-contact verification pause entirely. Only use this if you have personally confirmed the request is genuine through another channel. This action is permanently logged and cannot be undone."
          />
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
            <span className="mb-1.5 block font-medium">Why are you overriding the pause?</span>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. I called my son directly on his known number and confirmed this myself."
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          {error && <ErrorBanner title={error.title} message={error.message} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirm} loading={submitting}>
              Confirm manual override
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
