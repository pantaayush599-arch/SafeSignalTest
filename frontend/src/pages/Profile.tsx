import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Shield, Lock, ShieldAlert, Info, ChevronRight, LogOut, Mail,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { useIdentity } from "../state/identity";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

function ToggleRow({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked ?? true);
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-[var(--color-text-muted)]">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked((c) => !c)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--color-gold)]" : "bg-[var(--color-border-strong)]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}

export function Profile() {
  useDocumentTitle("Profile");
  const { identity, setIdentity } = useIdentity();
  const navigate = useNavigate();

  if (!identity) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)]/15 text-lg font-bold text-[var(--color-gold)]">
          {identity.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{identity.name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{identity.role === "requester" ? "Protected account" : "Trusted contact"}</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Theme" subtitle="Light, dark, or match your system." />
        <CardBody>
          <ThemeSwitcher />
        </CardBody>
      </Card>

      {identity.role === "requester" && (
        <Card>
          <Link to="/family" className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-surface-raised)]">
            <Users className="h-5 w-5 text-[var(--color-gold)]" />
            <span className="flex-1 text-sm font-semibold">Trusted contacts</span>
            <ChevronRight className="h-4 w-4 text-[var(--color-text-faint)]" />
          </Link>
        </Card>
      )}

      <Card>
        <CardHeader title="Security" subtitle="How this account is protected." />
        <CardBody className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-[var(--color-cyan)]" />
            <span>Signed in {identity.role === "requester" ? "as the protected account" : "as a trusted contact"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-[var(--color-text-muted)]" />
            <a href="mailto:support@safesignal.example" className="text-[var(--color-text-muted)] underline decoration-dotted">
              support@safesignal.example
            </a>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" />
        <CardBody className="divide-y divide-[var(--color-border)] p-0">
          <ToggleRow label="Verification alerts" description="Notify me when a trusted contact confirms or rejects a request." />
          <ToggleRow label="Weekly summary" description="A short recap of protection activity each week." defaultChecked={false} />
        </CardBody>
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-4">
          <Lock className="h-5 w-5 text-[var(--color-text-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Privacy</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              SafeSignal stores only what's needed to run verification: request transcripts, risk signals, and your
              trusted contacts. No permanent voiceprints, no call recordings kept beyond this demo session.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-4">
          <ShieldAlert className="h-5 w-5 text-[var(--color-danger)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Emergency settings</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              The "I think this is a scam" button is available on every screen and always pauses independently of automatic detection.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3 px-5 py-4">
          <Info className="h-5 w-5 text-[var(--color-text-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">About SafeSignal</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Prototype v1.0 — detect, pause, verify, decide. Never proves a voice is real; independently verifies before a risky action proceeds.
            </p>
          </div>
        </div>
      </Card>

      <button
        type="button"
        onClick={() => {
          setIdentity(null);
          navigate("/");
        }}
        className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-4 py-3 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
      >
        <LogOut className="h-4 w-4" />
        Switch persona / sign out
      </button>
    </div>
  );
}
