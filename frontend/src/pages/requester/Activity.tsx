import { ActivityFeed } from "../../components/ActivityFeed";
import { ErrorBanner } from "../../components/ui/Feedback";
import { useIdentity } from "../../state/identity";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export function Activity() {
  useDocumentTitle("Activity");
  const { identity } = useIdentity();

  if (!identity || identity.role !== "requester") {
    return <ErrorBanner title="No requester persona selected" message="Go to the home page and pick the requester persona." />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Activity</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">A security history of everything SafeSignal has detected, paused, and verified.</p>
      </div>
      <ActivityFeed token={identity.token} requesterId={identity.id} linkable />
    </div>
  );
}
