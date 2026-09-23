import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { triggerPanic } from "../api/client";
import { describeError } from "../lib/errors";
import { useIdentity } from "../state/identity";
import { recordRequestId } from "../pages/requester/RequestHistory";

/**
 * Manual in-call panic button (team scope: HIGH priority). Independent of
 * automatic risk detection -- the user decides they're suspicious right
 * now and jumps straight into the pause-and-verify flow.
 */
export function PanicButton() {
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  if (!identity || identity.role !== "requester") return null;

  async function handleTrigger() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await triggerPanic(identity!.token, note.trim() || undefined);
      recordRequestId(identity!.id, result.request_id);
      setOpen(false);
      setNote("");
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
        className="fixed bottom-5 right-4 z-30 flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/50 transition-transform hover:scale-105 hover:bg-red-700 sm:bottom-6 sm:right-6"
        aria-label="I think this is a scam — pause and verify now"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 0 0 3.2 20.5h17.6a1.5 1.5 0 0 0 1.3-2.09l-8.4-14.55a1.5 1.5 0 0 0-2.6 0Z"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">I think this is a scam</span>
      </button>

      <Modal open={open} onClose={() => !submitting && setOpen(false)} title="Pause &amp; verify now">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            This immediately pauses whatever you're worried about and sends a verification request to your trusted
            contact — independent of anything the automatic risk detection decided.
          </p>
          <label htmlFor="panic-note" className="text-sm">
            <span className="mb-1.5 block font-medium">What's happening? (optional)</span>
            <textarea
              id="panic-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Call claiming to be my son, asking for money urgently."
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          {error && <ErrorBanner title={error.title} message={error.message} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleTrigger} loading={submitting}>
              Pause &amp; verify now
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
