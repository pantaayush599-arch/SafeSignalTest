import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody } from "../../components/ui/Card";
import { RequestStatusBadge } from "../../components/ui/Badge";
import { Spinner, ErrorBanner, SuccessBanner } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { RiskAnalysisCard } from "../../components/RiskAnalysisCard";
import { ProtectedActionCard } from "../../components/ProtectedActionCard";
import { VerificationProgress } from "../../components/VerificationProgress";
import { ManualOverrideModal } from "../../components/ManualOverrideModal";
import { AuditTrail } from "../../components/AuditTrail";
import { FraudReportCard } from "../../components/FraudReportCard";
import { useIdentity } from "../../state/identity";
import { useRequestState } from "../../hooks/useRequestState";
import { manualOverride } from "../../api/client";
import { describeError } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function RequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  useDocumentTitle(requestId ? `Request ${requestId}` : "Request");
  const { identity } = useIdentity();
  const { state, error, loading, wsState, refresh } = useRequestState(identity?.token, requestId);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!identity || identity.role !== "requester") {
    return <ErrorBanner title="No requester persona selected" message="Go to the home page and pick the requester persona." />;
  }

  if (loading && !state) {
    return <Spinner label="Loading request state…" />;
  }

  if (error && !state) {
    const d = describeError(error);
    return <ErrorBanner title={d.title} message={d.message} />;
  }

  if (!state) return null;

  const canOverride = state.request_status === "STAYS-PAUSED" || state.request_status === "TIMED-OUT";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Request {state.request_id}</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {wsState === "open" ? "Live" : wsState === "connecting" ? "Connecting…" : "Reconnecting…"} · created{" "}
            {new Date(state.created_at).toLocaleString()}
          </p>
        </div>
        <RequestStatusBadge status={state.request_status} />
      </div>

      {state.request_status === "VERIFIED" && (
        <SuccessBanner title="Verified" message="Independent verification succeeded. The protected action is now unlocked." />
      )}
      {state.request_status === "MANUAL-OVERRIDE" && (
        <ErrorBanner
          title="Manually overridden"
          message={`This request bypassed verification. Reason given: "${state.override_reason}"`}
        />
      )}
      {state.request_status === "TIMED-OUT" && (
        <ErrorBanner title="Timed out" message="No tier resolved this request in time. The action remains locked." />
      )}
      {state.request_status === "PENDING" && state.decision === "REVIEW" && (
        <div className="rounded-lg border border-blue-900/60 bg-blue-950/30 px-4 py-3">
          <p className="text-sm font-semibold text-blue-300">Medium risk — review before proceeding</p>
          <p className="mt-0.5 text-sm text-blue-200/90">
            Some risk signals were detected, but not enough to automatically pause the action. It has not been
            locked and has not been auto-approved — decide for yourself whether to proceed, and consider verifying
            independently if anything feels off.
          </p>
        </div>
      )}

      <RiskAnalysisCard state={state} />
      <AnimatePresence mode="wait">
        <motion.div
          key={state.request_status}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <ProtectedActionCard state={state} />
        </motion.div>
      </AnimatePresence>

      {state.verification_required && (
        <VerificationProgress
          state={state}
          token={identity.token}
          onChanged={() => {
            refresh();
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {canOverride && (
        <Card>
          <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Genuine emergency, but can't reach a trusted contact?</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Manual override bypasses verification. It's always logged and never used automatically.
              </p>
            </div>
            <Button variant="danger" onClick={() => setOverrideOpen(true)}>
              Manual override…
            </Button>
          </CardBody>
        </Card>
      )}

      {canOverride && <FraudReportCard />}

      <AuditTrail token={identity.token} requestId={state.request_id} refreshKey={refreshKey} />

      <ManualOverrideModal
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        onConfirm={async (reason) => {
          await manualOverride(identity.token, state.request_id, reason);
          refresh();
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
