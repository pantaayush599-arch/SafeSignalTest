import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, Clock, Eye } from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { RequestStatusBadge } from "../../components/ui/Badge";
import { Spinner, ErrorBanner, SuccessBanner } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { RiskAnalysisCard } from "../../components/RiskAnalysisCard";
import { ProtectedActionCard } from "../../components/ProtectedActionCard";
import { VerificationProgress } from "../../components/VerificationProgress";
import { DemoSimulateControls } from "../../components/DemoSimulateControls";
import { ManualOverrideModal } from "../../components/ManualOverrideModal";
import { AuditTrail } from "../../components/AuditTrail";
import { FraudReportCard } from "../../components/FraudReportCard";
import { useIdentity } from "../../state/identity";
import { useSecurityState } from "../../state/securityState";
import { useRequestState } from "../../hooks/useRequestState";
import { manualOverride } from "../../api/client";
import { describeError } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import type { RequestStatus } from "../../api/types";

function securityStateFor(status: RequestStatus | undefined, verifying: boolean): "calm" | "risk" | "paused" | "verifying" | "verified" {
  if (status === "VERIFIED") return "verified";
  if (status === "MANUAL-OVERRIDE") return "verified";
  if (status === "STAYS-PAUSED") return verifying ? "verifying" : "paused";
  if (status === "TIMED-OUT") return "paused";
  if (status === "PENDING") return "risk";
  return "calm";
}

export function RequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  useDocumentTitle(requestId ? `Request ${requestId}` : "Request");
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const { state, error, loading, wsState, refresh } = useRequestState(identity?.token, requestId);
  const { setState: setSecurityState } = useSecurityState();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const verifying = Boolean(state?.verifications.some((v) => v.status === "PENDING"));
    setSecurityState(securityStateFor(state?.request_status, verifying));
  }, [state, setSecurityState]);

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

      <AnimatePresence>
        {state.request_status === "VERIFIED" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
            <SuccessBanner
              title="Verified — action unlocked"
              message="Your trusted contact independently confirmed this request."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {state.request_status === "MANUAL-OVERRIDE" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gold)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-gold)]">Manually overridden</p>
            <p className="mt-0.5 text-sm text-[var(--color-text)]/90">
              This bypassed independent verification. Reason given: “{state.override_reason}”. This is always logged
              and is never the same as a positive verification.
            </p>
          </div>
        </div>
      )}

      {state.request_status === "TIMED-OUT" && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-danger)]">Verification timed out</p>
              <p className="mt-0.5 text-sm text-[var(--color-text)]/90">
                No positive independent verification was received. The action remains paused — it was never
                automatically unlocked.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/home")}>
              Keep protected
            </Button>
            <Button variant="danger" onClick={() => navigate("/requester")}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {state.request_status === "PENDING" && state.decision === "REVIEW" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-cyan)]/35 bg-[var(--color-info-bg)] px-4 py-3">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-cyan)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-cyan)]">Medium risk — review before proceeding</p>
            <p className="mt-0.5 text-sm text-[var(--color-text)]/90">
              Some risk signals were detected, but not enough to automatically pause the action. It has not been
              locked and has not been auto-approved — decide for yourself, and verify independently if anything feels off.
            </p>
          </div>
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

      {state.request_status === "VERIFIED" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-success)]"
        >
          <CheckCircle2 className="h-4 w-4" /> Environment returning to calm
        </motion.div>
      )}

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

      {(() => {
        const pendingTier12 = state.verifications.find((v) => (v.tier === 1 || v.tier === 2) && v.status === "PENDING");
        if (!pendingTier12) return null;
        return (
          <DemoSimulateControls
            requesterToken={identity.token}
            requesterId={identity.id}
            verification={pendingTier12}
            onChanged={() => {
              refresh();
              setRefreshKey((k) => k + 1);
            }}
          />
        );
      })()}

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

      {canOverride && (
        <FraudReportCard token={identity.token} requestId={state.request_id} phoneNumber={state.caller_phone_number} />
      )}

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
