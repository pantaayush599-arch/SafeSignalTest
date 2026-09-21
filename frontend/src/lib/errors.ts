import { ApiError } from "../api/types";

/** Maps backend error codes to actionable, specific messages for the UI
 * (task spec #26: "not just 'something went wrong'"). */
export function describeError(err: unknown): { title: string; message: string } {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "AUDIO_UNPROCESSABLE":
        return {
          title: "Audio couldn't be used",
          message: "The audio was silent, an unsupported format, or corrupted. Try a different file, or switch to text input.",
        };
      case "STT_FAILED":
        return {
          title: "Transcription service failed",
          message: "The speech-to-text service errored or timed out. You can retry the upload, or switch to text input.",
        };
      case "REQUEST_NOT_FOUND":
        return { title: "Request not found", message: "This request doesn't exist, or you don't have access to it." };
      case "VERIFICATION_EXPIRED":
        return { title: "Verification expired", message: "This verification window has closed. The request has escalated or timed out." };
      case "VERIFICATION_NOT_FOUND":
        return { title: "Verification not found", message: "This verification link is invalid or no longer active." };
      case "MAX_ATTEMPTS_EXCEEDED":
        return { title: "Too many attempts", message: "The maximum number of code attempts has been used. The request is now timed out." };
      case "UNAUTHORIZED":
        return { title: "Sign-in required", message: "Your session token is missing or invalid. Please pick a persona again." };
      case "FORBIDDEN":
        return { title: "Not allowed", message: err.message || "You don't have permission to do that." };
      case "WRONG_TIER_STATE":
        return { title: "Already resolved", message: err.message || "This verification has already been responded to." };
      case "INVALID_INPUT":
        return { title: "Invalid input", message: err.message || "Please check the submitted values." };
      default:
        break;
    }
    if (err.status === 0) {
      return { title: "Can't reach SafeSignal", message: "The backend appears to be offline. Check your connection and try again." };
    }
    return { title: "Something went wrong", message: err.message || `Request failed (HTTP ${err.status}).` };
  }
  return { title: "Unexpected error", message: err instanceof Error ? err.message : String(err) };
}
