import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-5xl" aria-hidden="true">
        🛡️
      </div>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        We couldn't find that page, or the request it points to doesn't exist — possibly because it belongs to a
        different persona than the one you're signed in as.
      </p>
      <Link to="/">
        <Button>Back to SafeSignal home</Button>
      </Link>
    </div>
  );
}
