import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * SmartAvatar — renders an <img> when `src` is a real URL, otherwise
 * falls back to an emoji or the first letter of `name`. Also gracefully
 * recovers if the image fails to load (no broken-link / URL text leak).
 */
interface Props {
  src?: string | null;
  name?: string | null;
  fallback?: string; // emoji to use when no name/url
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

const isUrl = (v?: string | null) =>
  !!v && /^(https?:|data:|blob:)/i.test(v.trim());

const SmartAvatar = ({
  src,
  name,
  fallback = "👤",
  className,
  imgClassName,
  fallbackClassName,
}: Props) => {
  const [broken, setBroken] = useState(false);
  const showImg = isUrl(src) && !broken;
  const initial =
    (name && name.trim().charAt(0).toUpperCase()) || (fallback ?? "?");

  return (
    <div
      className={cn(
        "rounded-full bg-background flex items-center justify-center overflow-hidden",
        className
      )}
    >
      {showImg ? (
        <img
          src={src as string}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        <span className={cn("font-bold leading-none", fallbackClassName)}>
          {/* If `src` was an emoji (not a URL), prefer it; else show initial/fallback */}
          {!isUrl(src) && src ? src : initial}
        </span>
      )}
    </div>
  );
};

export default SmartAvatar;
