import { useEffect, useRef } from "react";

/**
 * Hidden Monetag invoke ad slot. Renders a 1px container styled as a tiny
 * decorative dot so users don't perceive it as advertising. The Monetag
 * invoke.js script (loaded once globally in index.html) attaches to the
 * container by id on mount.
 */
const AD_CONTAINER_ID = "container-ebc6eef0af8724f0d7a21aee1c123159";

const AdSlot = ({ className = "" }: { className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If invoke.js has already initialized the global container elsewhere,
    // this just no-ops. Re-trigger by re-injecting invoke.js if needed.
    // Most Monetag invoke containers self-mount via the script's own observer.
    const exists = document.getElementById(AD_CONTAINER_ID);
    if (!exists && ref.current) {
      ref.current.id = AD_CONTAINER_ID;
    }
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
