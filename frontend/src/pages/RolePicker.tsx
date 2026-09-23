import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody } from "../components/ui/Card";
import { Spinner, ErrorBanner } from "../components/ui/Feedback";
import { getDemoIdentities } from "../api/client";
import type { DemoIdentity } from "../api/types";
import { describeError } from "../lib/errors";
import { useIdentity } from "../state/identity";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { FirebaseLoginPanel } from "../components/FirebaseLoginPanel";

export function RolePicker() {
  useDocumentTitle("Sign in");
  const [identities, setIdentities] = useState<DemoIdentity[] | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const { setIdentity } = useIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    getDemoIdentities()
      .then(setIdentities)
      .catch((e) => setError(describeError(e)));
  }, []);

  function choose(identity: DemoIdentity) {
    setIdentity(identity);
    navigate(identity.role === "requester" ? "/home" : "/contact");
  }

  const requesters = identities?.filter((i) => i.role === "requester") ?? [];
  const contacts = identities?.filter((i) => i.role === "contact") ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">DETECT → PAUSE → VERIFY → DECIDE</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-muted)] sm:text-base">
          SafeSignal pauses high-risk, deepfake-style requests and requires independent verification before any
          consequential action goes through. Pick a persona below to try the demo from either side.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <FirebaseLoginPanel />
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 text-xs text-[var(--color-text-faint)]">
        <div className="h-px flex-1 bg-[var(--color-border)]" />
        demo personas (skip sign-in)
        <div className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      {error && <ErrorBanner title={error.title} message={error.message} />}
      {!identities && !error && (
        <div className="flex justify-center">
          <Spinner label="Loading demo personas…" />
        </div>
      )}

      {identities && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Requester
            </h2>
            <div className="flex flex-col gap-3">
              {requesters.map((r) => (
                <button key={r.id} onClick={() => choose(r)} className="text-left">
                  <Card className="transition-colors hover:border-[var(--color-gold)]">
                    <CardBody>
                      <p className="font-semibold">{r.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        The person receiving the risky request and about to perform the protected action.
                      </p>
                    </CardBody>
                  </Card>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Trusted contact
            </h2>
            <div className="flex flex-col gap-3">
              {contacts.map((c) => (
                <button key={c.id} onClick={() => choose(c)} className="text-left">
                  <Card className="transition-colors hover:border-[var(--color-gold)]">
                    <CardBody>
                      <p className="font-semibold">{c.name}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Independently verifies whether a request is genuine, on a channel the caller doesn't control.
                      </p>
                    </CardBody>
                  </Card>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
