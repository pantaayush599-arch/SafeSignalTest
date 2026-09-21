const REASON_LABELS: Record<string, string> = {
  money_request: "Money request",
  credential_otp_request: "OTP / credential request",
  emergency_claim: "Emergency claim",
  secrecy_request: "Asked to keep it secret",
  urgency_keyword: "Urgent language",
  unusual_amount_flag: "Unusual amount",
  deepfake_signal_advisory: "Deepfake signal (advisory)",
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code.replace(/_/g, " ");
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function eventLabel(event: string): string {
  return event
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
