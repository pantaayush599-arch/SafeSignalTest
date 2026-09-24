import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/Feedback";
import { useIdentity } from "../../state/identity";
import { analyzeRequest } from "../../api/client";
import { ApiError } from "../../api/types";
import { describeError } from "../../lib/errors";
import { AudioValidationError, fileToBase64, validateAudioFile } from "../../lib/audio";
import { recordRequestId } from "./RequestHistory";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

type Channel = "voice_call" | "video_call" | "text";
type InputMode = "TEXT" | "AUDIO";

const SCENARIOS = [
  {
    label: "High-risk: “I've been arrested”",
    channel: "voice_call" as Channel,
    claimed_identity: "son",
    amount: "80000",
    text: "Dad, I've been arrested. Send ₹80,000 right now. Please don't tell anyone.",
  },
  {
    label: "Low-risk: everyday message",
    channel: "text" as Channel,
    claimed_identity: "friend",
    amount: "",
    text: "Hey, are we still on for lunch tomorrow at 1pm?",
  },
];

type AudioState =
  | { kind: "none" }
  | { kind: "validating"; name: string }
  | { kind: "invalid"; name: string; message: string }
  | { kind: "ready"; name: string; sizeLabel: string };

export function RequesterHome() {
  useDocumentTitle("New request");
  const { identity } = useIdentity();
  const navigate = useNavigate();

  const [inputMode, setInputMode] = useState<InputMode>("TEXT");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<Channel>("voice_call");
  const [claimedIdentity, setClaimedIdentity] = useState("");
  const [callerPhoneNumber, setCallerPhoneNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [deepfakeScore, setDeepfakeScore] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioState, setAudioState] = useState<AudioState>({ kind: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string>("");
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!identity || identity.role !== "requester") {
    return (
      <ErrorBanner title="No requester persona selected" message="Go to the home page and pick the requester persona to simulate an incoming request." />
    );
  }
  // Captured as its own non-null-typed binding so closures below (handleSubmit)
  // don't need to re-narrow `identity` themselves.
  const requester = identity;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setAudioFile(null);
      setAudioState({ kind: "none" });
      return;
    }
    setAudioState({ kind: "validating", name: file.name });
    try {
      await validateAudioFile(file);
      setAudioFile(file);
      setAudioState({ kind: "ready", name: file.name, sizeLabel: `${(file.size / 1024).toFixed(0)} KB` });
    } catch (err) {
      setAudioFile(null);
      const message = err instanceof AudioValidationError ? err.message : "Could not validate this audio file.";
      setAudioState({ kind: "invalid", name: file.name, message });
    }
  }

  function fillScenario(s: (typeof SCENARIOS)[number]) {
    setInputMode("TEXT");
    setText(s.text);
    setChannel(s.channel);
    setClaimedIdentity(s.claimed_identity);
    setCallerPhoneNumber("");
    setAmount(s.amount);
    setAudioFile(null);
    setAudioState({ kind: "none" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guard against duplicate submits from a double-click
    setError(null);

    if (inputMode === "TEXT" && !text.trim()) {
      setError({ title: "Missing transcript", message: "Enter the message or call transcript to analyze." });
      return;
    }
    if (inputMode === "AUDIO" && !audioFile) {
      setError({ title: "No audio selected", message: "Choose a WAV, MP3, or WebM file, or switch to text input." });
      return;
    }

    setSubmitting(true);
    try {
      const requestId = `req_${crypto.randomUUID().slice(0, 8)}`;
      let audioB64: string | undefined;
      if (inputMode === "AUDIO" && audioFile) {
        setSubmitStage("Uploading audio…");
        audioB64 = await fileToBase64(audioFile);
      }
      setSubmitStage(inputMode === "AUDIO" ? "Transcribing and analyzing…" : "Analyzing request…");

      const result = await analyzeRequest(requester.token, {
        request_id: requestId,
        requester_id: requester.id,
        action_type: "wallet_transfer",
        channel,
        claimed_identity: claimedIdentity || undefined,
        caller_phone_number: callerPhoneNumber.trim() || undefined,
        amount: amount ? Number(amount) : undefined,
        deepfake_signal_score: deepfakeScore > 0 ? deepfakeScore : undefined,
        input_type: inputMode,
        transcript_or_text: inputMode === "TEXT" ? text : undefined,
        audio: audioB64,
      });
      recordRequestId(requester.id, result.request_id);
      navigate(`/requester/requests/${result.request_id}`);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "AUDIO_UNPROCESSABLE" || err.code === "STT_FAILED")) {
        setError(describeError(err));
      } else {
        setError(describeError(err));
      }
    } finally {
      setSubmitting(false);
      setSubmitStage("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Simulate an incoming request</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          This represents a call, video call, or message arriving on {identity.name}'s device. SafeSignal analyzes it,
          scores the risk, and pauses any consequential action before it can happen.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => fillScenario(s)}
            className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {s.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Request details" subtitle="Fields mirror the /analyze-request API contract." />
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <span className="mb-2 block text-sm font-medium">Input type</span>
              <div className="inline-flex rounded-lg border border-[var(--color-border-strong)] p-1" role="tablist" aria-label="Input type">
                {(["TEXT", "AUDIO"] as InputMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={inputMode === mode}
                    onClick={() => setInputMode(mode)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      inputMode === mode ? "bg-[var(--color-gold)] text-white" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {mode === "TEXT" ? "Text / transcript" : "Audio upload"}
                  </button>
                ))}
              </div>
            </div>

            {inputMode === "TEXT" ? (
              <div>
                <label htmlFor="transcript" className="mb-1.5 block text-sm font-medium">
                  Message or call transcript
                </label>
                <textarea
                  id="transcript"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                  placeholder="e.g. Dad, I've been arrested. Send ₹80,000 right now..."
                />
              </div>
            ) : (
              <div>
                <label htmlFor="audio-upload" className="mb-1.5 block text-sm font-medium">
                  Audio file
                </label>
                <input
                  ref={fileInputRef}
                  id="audio-upload"
                  type="file"
                  accept=".wav,.mp3,.webm,audio/wav,audio/mpeg,audio/webm"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-surface-raised)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--color-text)] hover:file:bg-[var(--color-border-strong)]"
                />
                <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">WAV, MP3, or WebM · max 5 MB · max 60 seconds</p>
                <div className="mt-2 min-h-5 text-sm">
                  {audioState.kind === "validating" && <span className="text-[var(--color-text-muted)]">Checking {audioState.name}…</span>}
                  {audioState.kind === "invalid" && <span className="text-[var(--color-risk-high)]">{audioState.message}</span>}
                  {audioState.kind === "ready" && (
                    <span className="text-[var(--color-risk-low)]">
                      Ready: {audioState.name} ({audioState.sizeLabel})
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="channel" className="mb-1.5 block text-sm font-medium">
                  Channel
                </label>
                <select
                  id="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Channel)}
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                >
                  <option value="voice_call">Voice call</option>
                  <option value="video_call">Video call</option>
                  <option value="text">Text message</option>
                </select>
              </div>
              <div>
                <label htmlFor="claimed" className="mb-1.5 block text-sm font-medium">
                  Claimed identity
                </label>
                <input
                  id="claimed"
                  value={claimedIdentity}
                  onChange={(e) => setClaimedIdentity(e.target.value)}
                  placeholder="e.g. son, daughter, colleague"
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                />
              </div>
              <div>
                <label htmlFor="caller-phone" className="mb-1.5 block text-sm font-medium">
                  Caller phone number (optional)
                </label>
                <input
                  id="caller-phone"
                  value={callerPhoneNumber}
                  onChange={(e) => setCallerPhoneNumber(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Checked against trusted contacts and community scam reports.
                </p>
              </div>
              <div>
                <label htmlFor="amount" className="mb-1.5 block text-sm font-medium">
                  Amount (optional)
                </label>
                <input
                  id="amount"
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="80000"
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                />
              </div>
              <div>
                <label htmlFor="deepfake" className="mb-1.5 block text-sm font-medium">
                  Deepfake advisory signal ({deepfakeScore.toFixed(2)})
                </label>
                <input
                  id="deepfake"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={deepfakeScore}
                  onChange={(e) => setDeepfakeScore(Number(e.target.value))}
                  className="w-full accent-[var(--color-gold)]"
                />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Optional. Advisory only — never the sole trigger.</p>
              </div>
            </div>

            {error && <ErrorBanner title={error.title} message={error.message} />}

            <Button type="submit" loading={submitting} fullWidth>
              {submitting ? submitStage || "Analyzing…" : "Analyze request"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
