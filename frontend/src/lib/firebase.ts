// Firebase Authentication (phone-number OTP + Google Sign-In), gated behind
// env config. There is no real Firebase project available in this build
// environment to test against, so the app must degrade honestly rather than
// crash or fake a login: `isFirebaseConfigured` is false whenever
// VITE_FIREBASE_API_KEY isn't set, and every caller checks it before
// touching `firebase/auth` APIs. When it IS configured (a real deployment
// supplies real project keys), this is the actual, real integration --
// phone OTP via RecaptchaVerifier + signInWithPhoneNumber, Google via
// signInWithPopup -- not a stub.
//
// The firebase SDK (~170KB gzipped) is only ever imported dynamically, from
// inside the functions below, so a user who signs in with a demo persona
// never pays for downloading it.
import type { ConfirmationResult } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let authPromise: Promise<import("firebase/auth").Auth> | null = null;

async function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID missing).");
  }
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp } = await import("firebase/app");
      const { getAuth } = await import("firebase/auth");
      const app = initializeApp(firebaseConfig);
      return getAuth(app);
    })();
  }
  return authPromise;
}

let recaptchaVerifier: import("firebase/auth").RecaptchaVerifier | null = null;

async function getRecaptcha(containerId: string) {
  const auth = await getFirebaseAuth();
  if (!recaptchaVerifier) {
    const { RecaptchaVerifier } = await import("firebase/auth");
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  }
  return recaptchaVerifier;
}

export async function sendPhoneOtp(phoneNumber: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const auth = await getFirebaseAuth();
  const verifier = await getRecaptcha(recaptchaContainerId);
  const { signInWithPhoneNumber } = await import("firebase/auth");
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function confirmPhoneOtp(confirmation: ConfirmationResult, code: string): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken();
}

export async function signInWithGoogle(): Promise<string> {
  const auth = await getFirebaseAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user.getIdToken();
}
