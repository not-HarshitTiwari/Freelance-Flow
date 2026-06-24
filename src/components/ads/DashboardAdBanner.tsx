"use client";

import { AdBanner } from "./AdBanner";

export function DashboardAdBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`px-6 pt-4 ${className}`}>
      <AdBanner format="horizontal" />
    </div>
  );
}
