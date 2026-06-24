"use client";

import { useEffect } from "react";

const PUB_ID = "ca-pub-8679297078256754";
const SLOT = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || "";

type AdBannerProps = {
  className?: string;
  format?: "horizontal" | "rectangle" | "vertical";
};

export function AdBanner({ className = "", format = "horizontal" }: AdBannerProps) {
  useEffect(() => {
    if (!SLOT) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet — safe to ignore
    }
  }, []);

  const heightClass =
    format === "rectangle" ? "min-h-[250px]" :
    format === "vertical"  ? "min-h-[600px]" :
    "min-h-[90px]";

  // Dev / no real pub ID — show a placeholder banner
  if (!SLOT) {
    return (
      <div className={`w-full ${heightClass} bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center ${className}`}>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
          📢 Advertisement<br />
          <span className="text-gray-300 dark:text-gray-600">Add your AdSense Pub ID in .env.local</span>
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
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
