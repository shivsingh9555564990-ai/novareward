// Persistent browser fingerprint for anti-fraud / one-device-one-account.
// Strategy:
// 1) Reuse a cached fp from localStorage if present (most stable across UA tweaks).
// 2) Otherwise build a fingerprint from a richer set of stable signals:
//    UA, language(s), screen, timezone, hardware, canvas hash, webgl renderer.
// 3) Hash + base36 the result, persist to localStorage, return.
//
// Notes:
// - We deliberately keep this synchronous-friendly. Canvas/WebGL probes are
//   wrapped in try/catch so privacy modes don't break us.
// - Not a true anti-fraud SDK; good enough to catch trivial multi-account abuse.

const STORAGE_KEY = "nova_device_fp_v2";

const safeCanvasHash = (): string => {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 240, 60);
    ctx.fillStyle = "#069";
    ctx.fillText("Nova-FP-✦", 4, 4);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Nova-FP-✦", 6, 22);
    return c.toDataURL().slice(-64);
  } catch {
    return "";
  }
};

const safeWebGLInfo = (): string => {
  try {
    const c = document.createElement("canvas");
    const gl =
      (c.getContext("webgl") as WebGLRenderingContext | null) ||
      (c.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? (gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL) as string)
      : (gl.getParameter(gl.RENDERER) as string);
    const vendor = dbg
      ? (gl.getParameter((dbg as any).UNMASKED_VENDOR_WEBGL) as string)
      : (gl.getParameter(gl.VENDOR) as string);
    return `${vendor}|${renderer}`;
  } catch {
    return "";
  }
};

const hash = (input: string): string => {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  // Mix with a second pass for better distribution
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h2 ^= input.charCodeAt(i);
    h2 = (h2 + ((h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24))) | 0;
  }
  return (Math.abs(h).toString(36) + Math.abs(h2).toString(36)).padStart(16, "0");
};

const computeFp = (): string => {
  const nav = window.navigator;
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();
  const langs = Array.isArray(nav.languages) ? nav.languages.join(",") : nav.language;
  const raw = [
    nav.userAgent,
    nav.platform,
    langs,
    nav.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    new Date().getTimezoneOffset(),
    tz,
    nav.hardwareConcurrency ?? "",
    (nav as any).deviceMemory ?? "",
    (nav as any).maxTouchPoints ?? "",
    safeCanvasHash(),
    safeWebGLInfo(),
  ].join("|");
  return hash(raw);
};

export const getDeviceFp = (): string => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && cached.length >= 8) return cached;
  } catch {
    // localStorage may be blocked; fall through to compute
  }

  const fp = computeFp();
  try {
    localStorage.setItem(STORAGE_KEY, fp);
  } catch {
    // ignore quota / blocked storage
  }
  return fp;
};

/** Force a recompute (e.g. for the debug page's "regenerate" action). */
export const resetDeviceFp = (): string => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return getDeviceFp();
};
