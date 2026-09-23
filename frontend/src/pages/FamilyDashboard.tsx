import { useParams } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { ErrorBanner } from "../components/ui/Feedback";
import { useIdentity } from "../state/identity";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * A trusted contact's view of a requester's protection history (task spec
 * section 23/26: "family" visibility) -- same feed as the requester's own
 * Activity screen, just not linkable into request detail (a contact
 * doesn't necessarily own every one of those requests' verifications).
 */
export function FamilyDashboard() {
  const { requesterId } = useParams<{ requesterId: string }>();
  useDocumentTitle("Family");
  const { identity } = useIdentity();

  if (!identity || !requesterId) {
    return <ErrorBanner title="Sign in required" message="Pick a persona to view family protection activity." />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Family protection</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Recent flagged requests and their outcomes.</p>
      </div>
      <ActivityFeed token={identity.token} requesterId={requesterId} linkable={identity.role === "requester"} />
    </div>
  );
}
