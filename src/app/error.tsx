"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, TriangleAlert } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <Zap size={32} className="text-violet-600 mb-6" />
      <TriangleAlert size={56} className="text-red-400 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">An unexpected error occurred. Try refreshing or contact support if the issue persists.</p>
      <div className="flex gap-3">
        <Button onClick={reset} className="bg-violet-600 hover:bg-violet-700 text-white">Try again</Button>
        <Button variant="outline" onClick={() => window.location.href = "/dashboard"} className="dark:border-gray-700 dark:text-gray-300">Go to Dashboard</Button>
      </div>
    </div>
  );
}
