import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IndianRupee, KeyRound, HeartHandshake, Play } from "lucide-react";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/Feedback";
import { useIdentity } from "../state/identity";
import { analyzeRequest } from "../api/client";
import { describeError } from "../lib/errors";
import { recordRequestId } from "./requester/RequestHistory";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

interface Scenario {
  id: string;
  icon: typeof IndianRupee;
  title: string;
  tagline: string;
  note: string;
  channel: "voice_call" | "video_call" | "text";
  action_type: string;
  claimed_identity: string;
  caller_phone_number?: string;
  amount?: number;
  transcript: string;
}

// Three named scenarios (design brief section 26). Each is a REAL call into
// /analyze-request -- the risk score, decision, and any amount/OTP framing
// shown afterward come entirely from the backend's actual response, never
// fabricated here. B and C intentionally carry no `amount` so the resulting
// screen must NOT show a transfer figure that was never in the transcript.
// B's caller_phone_number matches the seeded crowd-reported scam number,
// and C's claims to be "Uncle" (a real trusted contact) from a DIFFERENT
// number than his registered one -- both demonstrate real, backend-computed
// context checks, not scripted UI states.
const SCENARIOS: Scenario[] = [
  {
    id: "financial-emergency",
    icon: IndianRupee,
    title: "A. Financial emergency",
    tagline: "A fabricated arrest story pressuring an immediate money transfer.",
    note: "Expect: HIGH risk, a real ₹80,000 transfer shown, Tier 1 verification required.",
    channel: "voice_call",
    action_type: "wallet_transfer",
    claimed_identity: "son",
    amount: 80000,
    transcript: "Dad, I've been arrested. Send ₹80,000 right now, immediately. Please don't tell mom.",
  },
  {
    id: "otp-scam",
    icon: KeyRound,
    title: "B. OTP / credential scam",
    tagline: "A claimed bank caller, from a number the community has already reported — no money mentioned.",
    note: "Expect: HIGH risk, a community scam-report flag, an OTP/credential summary — never a fabricated transfer amount.",
    channel: "voice_call",
    action_type: "otp_share",
    claimed_identity: "bank support executive",
    caller_phone_number: "+911800000666",
    transcript: "Your account will be blocked in 5 minutes. Give me the OTP immediately, share the code now, it's urgent.",
  },
  {
    id: "family-impersonation",
    icon: HeartHandshake,
    title: "C. Family impersonation, no money",
    tagline: "A caller claiming to be a real trusted contact, from an unrecognized number — no transfer, no OTP.",
    note: "Expect: elevated risk from a known-contact number mismatch plus urgency/secrecy — no amount or OTP shown.",
    channel: "video_call",
    action_type: "other",
    claimed_identity: "Uncle",
    caller_phone_number: "+919555512345",
    transcript: "It's Uncle Rohan. I'm stuck somewhere and it's urgent, please don't tell your dad yet, just keep this between us for now.",
  },
];

export function DemoMode() {
  useDocumentTitle("Demo mode");
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  if (!identity || identity.role !== "requester") {
    return (
      <ErrorBanner
        title="No requester persona selected"
        message="Go to the home page and pick the requester persona before running a demo scenario."
      />
    );
  }

  async function run(scenario: Scenario) {
    if (runningId) return;
    setRunningId(scenario.id);
    setError(null);
    try {
      const requestId = `req_demo_${scenario.id}_${crypto.randomUUID().slice(0, 6)}`;
      const result = await analyzeRequest(identity!.token, {
        request_id: requestId,
        requester_id: identity!.id,
        action_type: scenario.action_type,
        channel: scenario.channel,
        claimed_identity: scenario.claimed_identity,
        caller_phone_number: scenario.caller_phone_number,
        amount: scenario.amount,
        input_type: "TEXT",
        transcript_or_text: scenario.transcript,
      });
      recordRequestId(identity!.id, result.request_id);
      navigate(`/requester/requests/${result.request_id}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Demo mode</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Run a pre-written scenario end-to-end through the real DETECT → PAUSE → VERIFY → DECIDE pipeline. Every
          screen you see afterward reflects the backend's actual analysis — nothing on the results screen is
          pre-scripted.
        </p>
      </div>

      {error && <ErrorBanner title={error.title} message={error.message} />}

      <div className="flex flex-col gap-4">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[var(--color-gold)]" /> {s.title}
                  </span>
                }
                subtitle={s.tagline}
              />
              <CardBody className="flex flex-col gap-3">
                <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3.5 py-3 text-sm italic text-[var(--color-text)]/90">
                  “{s.transcript}”
                </p>
                <p className="text-xs text-[var(--color-text-faint)]">{s.note}</p>
                <Button
                  onClick={() => run(s)}
                  loading={runningId === s.id}
                  disabled={runningId !== null && runningId !== s.id}
                  icon={<Play className="h-4 w-4" />}
                >
                  Run this scenario
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
