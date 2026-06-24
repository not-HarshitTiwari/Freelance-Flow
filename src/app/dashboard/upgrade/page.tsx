"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Zap, IndianRupee, Sparkles, Receipt, Users, Mail } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const features = [
  { icon: Sparkles, text: "AI proposal generation (unlimited)" },
  { icon: Receipt, text: "Invoice creation & tracking" },
  { icon: Users, text: "Unlimited clients" },
  { icon: Mail, text: "Automated payment reminders" },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment. Check your internet connection.");
        return;
      }

      const res = await fetch("/api/subscription", { method: "POST" });
      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const options = {
        key: data.keyId,
        subscription_id: data.subscription.id,
        name: "FreelanceFlow",
        description: "Pro Plan — ₹999/month",
        handler: async (response: { razorpay_subscription_id: string }) => {
          await fetch("/api/subscription", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: response.razorpay_subscription_id }),
          });
          toast.success("You're now a Pro member!");
          router.push("/dashboard");
          router.refresh();
        },
        prefill: {},
        theme: { color: "#7c3aed" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-100 rounded-full mb-4">
          <Zap className="text-violet-600" size={24} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Upgrade to Pro</h1>
        <p className="text-gray-500 mt-2">Unlock all features and grow your freelance business</p>
      </div>

      <Card className="border-2 border-violet-600 shadow-lg mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-1 mb-1">
            <IndianRupee size={24} className="text-gray-900" />
            <span className="text-4xl font-bold text-gray-900">999</span>
          </div>
          <p className="text-center text-gray-500 text-sm mb-6">per month • cancel anytime</p>

          <ul className="space-y-3 mb-6">
            {features.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-gray-700">
                <CheckCircle size={16} className="text-violet-600 shrink-0" />
                {f.text}
              </li>
            ))}
          </ul>

          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700"
            size="lg"
          >
            {loading ? "Processing..." : "Pay ₹999/month with Razorpay"}
          </Button>
          <p className="text-xs text-center text-gray-400 mt-3">
            UPI • Cards • Netbanking • Wallets
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
