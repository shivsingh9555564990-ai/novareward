// Biometric (WebAuthn) helper for one-tap re-login on the same device.
//
// Strategy (privacy-respecting, no server dependency):
// 1. After a successful login, we store the *current* Supabase refresh token
//    in localStorage under `nova_bio_token`.
// 2. We register a platform passkey via WebAuthn (`navigator.credentials.create`)
//    and remember the resulting credential id under `nova_bio_cred`.
// 3. On next visit, the "Biometric" button calls `navigator.credentials.get`
//    with that credential id. The OS asks for fingerprint / face. On success
//    we restore the Supabase session from the stored refresh token.
//
// The refresh token never leaves the device. Without a successful biometric
// prompt the button does nothing useful — and on an unsupported device we
// simply tell the user.

import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "nova_bio_token";
const CRED_KEY = "nova_bio_cred";
const EMAIL_KEY = "nova_bio_email";

const b64uToBuf = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};

const bufToB64u = (b: ArrayBuffer) => {
  const bytes = new Uint8Array(b);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const randomBytes = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
};

export const biometricSupported = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function" &&
    window.isSecureContext === true
  );
};

export const biometricEnrolled = (): boolean => {
  try {
    return !!localStorage.getItem(CRED_KEY) && !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
};

export const biometricEmailHint = (): string | null => {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
};

/**
 * Register a platform passkey for the currently signed-in user and stash the
 * current refresh token locally so the biometric prompt can restore the session.
 */
export const enrollBiometric = async (): Promise<void> => {
  if (!biometricSupported()) {
    throw new Error("Biometric not supported on this device/browser");
  }

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.refresh_token || !session.user?.id) {
    throw new Error("You must be logged in to enable biometric");
  }

  const userIdBytes = new TextEncoder().encode(session.user.id);
  const opts: CredentialCreationOptions = {
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "NovaRewards", id: window.location.hostname },
      user: {
        id: userIdBytes,
        name: session.user.email ?? "user",
        displayName: session.user.email ?? "Nova user",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  };

  const cred = (await navigator.credentials.create(opts)) as PublicKeyCredential | null;
  if (!cred) throw new Error("Biometric setup cancelled");

  const credId = bufToB64u(cred.rawId);
  localStorage.setItem(CRED_KEY, credId);
  localStorage.setItem(TOKEN_KEY, session.refresh_token);
  if (session.user.email) localStorage.setItem(EMAIL_KEY, session.user.email);
};

/**
 * Prompt the OS biometric, then restore the Supabase session from the
 * stored refresh token. Returns the restored user id.
 */
export const loginWithBiometric = async (): Promise<string> => {
  if (!biometricSupported()) {
    throw new Error("Biometric not supported on this device/browser");
  }

  const credIdB64 = localStorage.getItem(CRED_KEY);
  const refreshToken = localStorage.getItem(TOKEN_KEY);
  if (!credIdB64 || !refreshToken) {
    throw new Error("No biometric registered on this device. Login once, then enable it from Profile.");
  }

  const opts: CredentialRequestOptions = {
    publicKey: {
      challenge: randomBytes(32),
      rpId: window.location.hostname,
      timeout: 60_000,
      userVerification: "required",
      allowCredentials: [
        {
          id: b64uToBuf(credIdB64),
          type: "public-key",
          transports: ["internal"],
        },
      ],
    },
  };

  const assertion = (await navigator.credentials.get(opts)) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Biometric cancelled");

  // Biometric verified by the OS — restore the Supabase session.
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session?.user) {
    // Token expired / revoked → wipe and ask for password.
    localStorage.removeItem(TOKEN_KEY);
    throw new Error("Saved session expired. Please log in with password once.");
  }
  // Refresh tokens rotate — store the new one.
  if (data.session.refresh_token) {
    localStorage.setItem(TOKEN_KEY, data.session.refresh_token);
  }
  return data.session.user.id;
};

export const disableBiometric = (): void => {
  try {
    localStorage.removeItem(CRED_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    // ignore
  }
};

/**
 * After every successful normal login, refresh the stored token so biometric
 * keeps working. Safe to call even when biometric isn't enrolled.
 */
export const refreshBiometricToken = async (): Promise<void> => {
  if (!biometricEnrolled()) return;
  const { data } = await supabase.auth.getSession();
  const t = data.session?.refresh_token;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  if (data.session?.user?.email) localStorage.setItem(EMAIL_KEY, data.session.user.email);
};
