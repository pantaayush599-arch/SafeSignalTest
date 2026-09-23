import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ConfirmationResult } from "firebase/auth";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { ErrorBanner } from "./ui/Feedback";
import { isFirebaseConfigured, sendPhoneOtp, confirmPhoneOtp, signInWithGoogle } from "../lib/firebase";
import { loginWithFirebaseToken } from "../api/client";
import { describeError } from "../lib/errors";
import { useIdentity } from "../state/identity";

const RECAPTCHA_CONTAINER_ID = "firebase-recaptcha-container";

type Step = "phone" | "code";

export function FirebaseLoginPanel() {
  const { setIdentity } = useIdentity();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState<"phone" | "code" | "google" | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  async function completeLogin(idToken: string) {
    const result = await loginWithFirebaseToken(idToken);
    setIdentity({ role: "requester", id: result.requester_id, name: result.name, token: result.session_token });
    navigate("/requester");
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy("phone");
    try {
      const result = await sendPhoneOtp(phone, RECAPTCHA_CONTAINER_ID);
      setConfirmation(result);
      setStep("code");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !confirmation) return;
    setError(null);
    setBusy("code");
    try {
      const idToken = await confirmPhoneOtp(confirmation, code);
      await completeLogin(idToken);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setError(null);
    setBusy("google");
    try {
      const idToken = await signInWithGoogle();
      await completeLogin(idToken);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <Card className="border-dashed">
        <CardBody className="text-center">
          <p className="text-sm font-semibold">Firebase sign-in isn't configured in this environment</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            No VITE_FIREBASE_API_KEY is set, so phone/Google sign-in can't run here. Use a demo persona below to try
            the app instead.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Sign in" subtitle="Phone number or Google — verified server-side against your Firebase project." />
      <CardBody className="flex flex-col gap-4">
        <div id={RECAPTCHA_CONTAINER_ID} />

        {step === "phone" && (
          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            <label htmlFor="phone-input" className="text-sm font-medium">
              Phone number
            </label>
            <input
              id="phone-input"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            />
            <Button type="submit" loading={busy === "phone"} fullWidth>
              Send code
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <label htmlFor="otp-input" className="text-sm font-medium">
              Enter the code sent to {phone}
            </label>
            <input
              id="otp-input"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 font-mono text-lg tracking-[0.3em] outline-none focus:border-[var(--color-brand)]"
            />
            <Button type="submit" loading={busy === "code"} fullWidth>
              Verify &amp; sign in
            </Button>
            <button type="button" onClick={() => setStep("phone")} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Use a different number
            </button>
          </form>
        )}

        <div className="flex items-center gap-3 text-xs text-[var(--color-text-faint)]">
          <div className="h-px flex-1 bg-[var(--color-border)]" />
          or
          <div className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        <Button variant="secondary" onClick={handleGoogle} loading={busy === "google"} fullWidth>
          Continue with Google
        </Button>

        {error && <ErrorBanner title={error.title} message={error.message} />}
      </CardBody>
    </Card>
  );
}
