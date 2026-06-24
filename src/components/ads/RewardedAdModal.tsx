"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PlayCircle, X, CheckCircle } from "lucide-react";

const PUB_ID = "ca-pub-8679297078256754";
const REWARDED_SLOT = process.env.NEXT_PUBLIC_ADSENSE_REWARDED_SLOT || "";
const IS_REAL_AD = !!REWARDED_SLOT;

type Props = {
  open: boolean;
  title: string;          // e.g. "Generate Proposal"
  description: string;    // e.g. "Watch a short ad to generate one proposal for free"
  onRewarded: () => void; // called when ad completes
  onClose: () => void;
};

export function RewardedAdModal({ open, title, description, onRewarded, onClose }: Props) {
  const [phase, setPhase] = useState<"idle" | "loading" | "watching" | "done">("idle");
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for simulated / real ad
  useEffect(() => {
    if (phase !== "watching") return;
    if (countdown <= 0) { setPhase("done"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const startAd = useCallback(() => {
    setPhase("loading");

    if (IS_REAL_AD) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({
          params: {
            google_ad_client: PUB_ID,
            google_ad_slot: REWARDED_SLOT,
          },
          format: "rewarded",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (slot: any) => {
            setPhase("watching");
            setCountdown(5);
            slot?.addEventListener?.("reward", () => {
              setPhase("done");
            });
            slot?.addEventListener?.("close", () => {
              if (phase !== "done") setPhase("idle");
            });
          },
        });
        return;
      } catch {
        // Fall through to simulation
      }
    }

    // Simulated countdown (dev mode / no real ad configured)
    setTimeout(() => {
      setPhase("watching");
      setCountdown(5);
    }, 800);
  }, [phase]);

  const handleClaim = useCallback(() => {
    setPhase("idle");
    onRewarded();
  }, [onRewarded]);

  const handleClose = useCallback(() => {
    setPhase("idle");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-violet-600 p-5 text-white relative">
          <button onClick={handleClose} className="absolute top-3 right-3 text-violet-200 hover:text-white">
            <X size={18} />
          </button>
          <PlayCircle size={28} className="mb-2" />
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-violet-200 text-sm mt-1">{description}</p>
        </div>

        <div className="p-6 text-center">
          {phase === "idle" && (
            <>
              {!IS_REAL_AD && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  Demo mode — add your AdSense IDs in <code>.env.local</code> for real ads
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                Watch a short video ad to unlock this feature for free — no subscription needed.
              </p>
              <Button onClick={startAd} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2">
                <PlayCircle size={16} /> Watch Ad &amp; Unlock
              </Button>
            </>
          )}

          {phase === "loading" && (
            <div className="py-4">
              <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading ad...</p>
            </div>
          )}

          {phase === "watching" && (
            <div className="py-4">
              {/* Simulated ad area */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full h-40 flex items-center justify-center mb-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30" />
                <div className="relative text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Advertisement</p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{countdown}s</p>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  Ad {countdown}s
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Watching ad... Please wait</p>
            </div>
          )}

          {phase === "done" && (
            <div className="py-4">
              <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Ad watched!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">You&apos;ve unlocked this action for free.</p>
              <Button onClick={handleClaim} className="w-full bg-green-600 hover:bg-green-700 text-white">
                Claim &amp; Continue
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Or{" "}
            <a href="/dashboard/upgrade" className="text-violet-600 dark:text-violet-400 underline">
              upgrade to Pro
            </a>{" "}
            for unlimited access with no ads.
          </p>
        </div>
      </div>
    </div>
  );
}
