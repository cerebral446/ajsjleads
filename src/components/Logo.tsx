"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Company logo with a text fallback.
 *   onDark  → /ajsj-logo.png        (white mark, for the navy header)
 *   onLight → /ajsj-logo-black.png  (dark mark, for light backgrounds)
 * Replace those files in /public to update the logo everywhere.
 */
export function Logo({
  tone = "onDark",
  className = "h-11 w-auto",
}: {
  tone?: "onDark" | "onLight";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const src = tone === "onDark" ? "/ajsj-logo.png" : "/ajsj-logo-black.png";

  // Catch errors that happened before hydration
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span
        className={`font-semibold uppercase tracking-[0.18em] ${
          tone === "onDark" ? "text-white" : "text-navy-950"
        } text-sm`}
      >
        AJSJ Services LLC
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt="AJSJ Services LLC" className={className} onError={() => setFailed(true)} />
  );
}
