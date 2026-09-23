import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneIncoming, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ErrorBanner, Spinner } from "../../components/ui/Feedback";
import { SecurityStatusHero } from "../../components/SecurityStatusHero";
import { ActivityFeed } from "../../components/ActivityFeed";
import { useIdentity } from "../../state/identity";
import { useSecurityState } from "../../state/securityState";
import { getDashboard } from "../../api/client";
import { describeError } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Home() {
  useDocumentTitle("Home");
  const { identity } = useIdentity();
  const { state, setState } = useSecurityState();
  const [pausedCount, setPausedCount] = useState<number | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [pausedRequestId, setPausedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!identity || identity.role !== "requester") return;
    getDashboard(identity.token, identity.id)
      .then((d) => {
        const paused = d.entries.filter((e) => e.request_status === "STAYS-PAUSED");
        setPausedCount(paused.length);
        setPausedRequestId(paused[0]?.request_id ?? null);
        setState(paused.length > 0 ? "paused" : "calm");
      })
      .catch((e) => setError(describeError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  if (!identity || identity.role !== "requester") {
    return <ErrorBanner title="No requester persona selected" message="Go to the home page and pick the requester persona." />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-[var(--color-text-muted)]">{greeting()}, {identity.name.split(" ")[0]}</p>
      </div>

      <Card className={state === "paused" ? "border-[var(--color-gold)]/40" : undefined}>
        <CardBody>
          <SecurityStatusHero state={state} />
          {pausedCount !== null && pausedCount > 0 && pausedRequestId && (
            <div className="mx-auto max-w-sm rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-4 py-3 text-center">
              <p className="text-sm font-semibold">
                {pausedCount} action{pausedCount > 1 ? "s" : ""} still paused
              </p>
              <Link to={`/requester/requests/${pausedRequestId}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-gold)] hover:underline">
                Review now <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      <Link to="/requester">
        <Card className="transition-colors hover:border-[var(--color-cyan)]/50">
          <CardBody className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)]/15">
              <PhoneIncoming className="h-5 w-5 text-[var(--color-cyan)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Simulate an incoming request</p>
              <p className="text-xs text-[var(--color-text-muted)]">Try a call, video call, or message and see SafeSignal react.</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" />
          </CardBody>
        </Card>
      </Link>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Recent protection</h2>
          <Link to="/activity" className="text-xs font-semibold text-[var(--color-cyan)] hover:underline">
            View all
          </Link>
        </div>
        {error ? (
          <ErrorBanner title={error.title} message={error.message} />
        ) : (
          <ActivityFeed token={identity.token} requesterId={identity.id} linkable grouped={false} limit={4} />
        )}
      </div>

      <Card className="border-[var(--color-danger)]/25">
        <CardBody className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--color-danger)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Feeling pressured right now?</p>
            <p className="text-xs text-[var(--color-text-muted)]">Use the emergency button in the corner of any screen.</p>
          </div>
        </CardBody>
      </Card>

      {pausedCount === null && !error && <Spinner label="Loading your protection status…" />}

      <div className="flex justify-center">
        <Link to="/demo">
          <Button variant="secondary">View demo walkthrough</Button>
        </Link>
      </div>
    </div>
  );
}
