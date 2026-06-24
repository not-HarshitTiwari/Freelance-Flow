"use client";

import { useEffect, useRef } from "react";

const PUB_ID = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID!;
const SLOT   = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT!;
const IS_DEV = process.env.NODE_ENV === "development";

type AdBannerProps = {
  className?: string;
  format?: "horizontal" | "rectangle" | "vertical";
};

export function AdBanner({ className = "", format = "horizontal" }: AdBannerProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (IS_DEV || pushed.current) return;
    pushed.current = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch { /* ignore */ }
  }, []);

  const heightClass =
    format === "rectangle" ? "h-[250px]" :
    format === "vertical"  ? "h-[600px]" :
    "h-[90px]";

  // Show placeholder in dev so you can see ad positions
  if (IS_DEV) {
    return (
      <div className={`w-full ${heightClass} bg-yellow-50 dark:bg-yellow-900/20 border-2 border-dashed border-yellow-400 dark:border-yellow-600 rounded-lg flex items-center justify-center ${className}`}>
        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium text-center">
          📢 AD SLOT ({format})<br />
          <span className="font-normal opacity-70">Shows real ad after deploy</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden ${heightClass} ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={PUB_ID}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
