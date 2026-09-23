import type { RequestStateOut, ContactInboxItem } from "../api/types";
import { formatCurrency } from "./format";

export type ProtectedActionKind = "transfer" | "otp" | "generic";

export interface ProtectedActionSummary {
  kind: ProtectedActionKind;
  title: string;
  subtitle: string;
}

/**
 * Derives what the "protected action" screen should show, strictly from
 * fields the backend actually returned -- never fabricated (task spec
 * section 11/31). A transfer amount is only shown when the backend
 * actually carries an `amount`; an OTP/credential summary only when that
 * signal was actually detected; otherwise a generic high-risk summary.
 */
export function deriveProtectedAction(
  data: Pick<RequestStateOut, "amount" | "reason_codes"> | Pick<ContactInboxItem, "amount" | "reason_codes">
): ProtectedActionSummary {
  if (data.amount !== null && data.amount !== undefined && data.amount > 0) {
    return {
      kind: "transfer",
      title: `${formatCurrency(data.amount)} Transfer`,
      subtitle: "UPI / wallet transfer — simulated, no real funds move.",
    };
  }
  if (data.reason_codes.includes("credential_otp_request")) {
    return {
      kind: "otp",
      title: "OTP / Credential Request",
      subtitle: "Someone asked for a one-time code or password.",
    };
  }
  return {
    kind: "generic",
    title: "High-Risk Request",
    subtitle: "A consequential action tied to this request has been identified as risky.",
  };
}
