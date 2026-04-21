// Lightweight browser fingerprint for anti-fraud on daily claims.
// Not a full fingerprinting library — just enough to catch trivial multi-account abuse.
export const getDeviceFp = (): string => {
  const nav = window.navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency ?? "",
    (nav as any).deviceMemory ?? "",
  ].join("|");
  // Simple hash
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
};
