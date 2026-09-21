// Client-side audio validation, mirroring the frozen constraints from the
// STT architecture doc: WAV/MP3/WebM, <=5MB raw, <=60s duration. The
// backend re-validates independently -- this is just fast user feedback.
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 60;
export const ALLOWED_EXTENSIONS = ["wav", "mp3", "webm"];

export class AudioValidationError extends Error {}

function extensionOf(file: File): string | null {
  const parts = file.name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

export async function validateAudioFile(file: File): Promise<void> {
  const ext = extensionOf(file);
  const mimeOk = /^audio\/(wav|x-wav|mpeg|mp3|webm)$/.test(file.type) || file.type === "";
  if ((!ext || !ALLOWED_EXTENSIONS.includes(ext)) && !mimeOk) {
    throw new AudioValidationError("Unsupported file type. Please upload a WAV, MP3, or WebM audio file.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new AudioValidationError(
      `Audio file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 5 MB.`
    );
  }

  const duration = await getAudioDuration(file).catch(() => null);
  if (duration !== null && duration > MAX_AUDIO_SECONDS) {
    throw new AudioValidationError(`Audio is too long (${Math.round(duration)}s). Maximum is 60 seconds.`);
  }
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read audio metadata"));
    };
    audio.src = url;
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read the audio file."));
    reader.readAsDataURL(file);
  });
}
