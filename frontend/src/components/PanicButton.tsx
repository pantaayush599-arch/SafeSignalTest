import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, ShieldAlert } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { triggerPanic } from "../api/client";
import { describeError } from "../lib/errors";
import { useIdentity } from "../state/identity";
import { recordRequestId } from "../pages/requester/RequestHistory";

const REASONS = [
  "Someone is asking me to send money",
  "Someone is asking for an OTP or password",
  "Someone is pressuring me to act immediately",
  "Someone is pretending to be a family member",
  "Someone is threatening me or creating an emergency",
  "I received a suspicious call or message",
];
const OTHER = "Other";

/**
 * Manual in-call panic button / emergency flow (team scope: HIGH priority;
 * task spec section 16). Independent of automatic risk detection -- the
 * user decides they're suspicious right now and jumps straight into the
 * pause-and-verify flow. Selectable reasons, not a freeform box by default.
 */
export function PanicButton() {
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  if (!identity || identity.role !== "requester") return null;

  function toggle(reason: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
    setOtherText("");
    setError(null);
  }

  async function handleTrigger() {
    if (submitting) return;
    const parts = [...selected].filter((r) => r !== OTHER);
    if (selected.has(OTHER) && otherText.trim()) parts.push(otherText.trim());
    const note = parts.length > 0 ? parts.join("; ") : undefined;

    setSubmitting(true);
    setError(null);
    try {
      const result = await triggerPanic(identity!.token, note);
      recordRequestId(identity!.id, result.request_id);
      setOpen(false);
      reset();
      navigate(`/requester/requests/${result.request_id}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-[var(--color-danger)] px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 hover:brightness-110 md:bottom-6 md:right-6"
        aria-label="I think this is a scam — pause and verify now"
      >
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">I think this is a scam</span>
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            reset();
          }
        }}
        title="What happened?"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-3.5 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden="true" />
            <p className="text-xs text-[var(--color-text)]/90">
              Tell us what feels suspicious. This pauses the action immediately and starts independent verification —
              separate from anything the automatic risk detection decided.
            </p>
          </div>

          <div role="group" aria-label="What happened?" className="flex flex-col gap-2">
            {[...REASONS, OTHER].map((reason) => {
              const isSelected = selected.has(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggle(reason)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-text)]"
                      : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {reason}
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[#1a1204]" : "border-[var(--color-border-strong)]"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>

          {selected.has(OTHER) && (
            <label htmlFor="panic-other" className="text-sm">
              <span className="mb-1.5 block font-medium">Tell us more</span>
              <textarea
                id="panic-other"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value.slice(0, 300))}
                rows={3}
                maxLength={300}
                placeholder="Briefly describe what's happening…"
                className="w-full resize-y rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-[var(--color-gold)]"
              />
              <span className="mt-1 block text-right text-xs text-[var(--color-text-faint)]">{otherText.length}/300</span>
            </label>
          )}

          {error && <ErrorBanner title={error.title} message={error.message} />}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleTrigger} loading={submitting}>
              Protect me
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
