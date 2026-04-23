import { useEffect, useRef } from "react";

/**
 * Hidden Monetag ad slot. Dynamically injects the Monetag scripts on mount
 * (so they NEVER load on auth/onboarding screens — only on game pages where
 * <AdSlot /> is rendered) and renders an invisible 1px container so users
 * don't perceive it as advertising.
 *
 * Scripts are loaded only once per page session (idempotent).
 */
const AD_CONTAINER_ID = "container-ebc6eef0af8724f0d7a21aee1c123159";

const SCRIPTS = [
  { src: "https://pl29223767.profitablecpmratenetwork.com/b8/bc/55/b8bc555369775b9bd40b0c040ccbb0b3.js", attrs: {} as Record<string, string> },
  { src: "https://pl29223775.profitablecpmratenetwork.com/7b/a8/d7/7ba8d7dcc3cd085424516769ba4d2f74.js", attrs: {} },
  { src: "https://pl29223774.profitablecpmratenetwork.com/ebc6eef0af8724f0d7a21aee1c123159/invoke.js", attrs: { async: "async", "data-cfasync": "false" } },
];

const ensureScriptsLoaded = () => {
  SCRIPTS.forEach(({ src, attrs }) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    document.body.appendChild(s);
  });
};

const AdSlot = ({ className = "" }: { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document.getElementById(AD_CONTAINER_ID) && ref.current) {
      ref.current.id = AD_CONTAINER_ID;
    }
    ensureScriptsLoaded();
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed bottom-0 right-0 h-px w-px overflow-hidden opacity-0 ${className}`}
    >
      <div ref={ref} id={AD_CONTAINER_ID} />
    </div>
  );
};

export default AdSlot;
