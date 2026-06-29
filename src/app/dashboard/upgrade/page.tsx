"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import { usePlan, planAtLeast } from "@/lib/plan-context";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

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

const PLANS = [
  {
    key: "basic",
    label: "Basic",
    price: 499,
    color: "border-blue-400",
    highlight: false,
    features: [
      "Unlimited invoices",
      "Unlimited clients",
      "All 3 PDF templates",
      "Invoice & proposal email sending",
      "Contracts with e-signatures",
      "Expense receipt uploads",
      "CSV exports (invoices, time, expenses)",
      "No ads",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    price: 999,
    color: "border-violet-600",
    highlight: true,
    features: [
      "Everything in Basic",
      "AI proposal generation (unlimited)",
      "Recurring invoices (auto-generate)",
      "Razorpay payment links",
      "Automated payment reminders",
    ],
  },
  {
    key: "advanced",
    label: "Advanced",
    price: 1999,
    color: "border-amber-400",
    highlight: false,
    features: [
      "Everything in Pro",
      "Bulk invoice operations",
      "Multi-currency PDF",
      "White-label client portal",
    ],
  },
] as const;

export default function UpgradePage() {
  const router = useRouter();
  const currentPlan = usePlan();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(planKey: string, price: number, label: string) {
    setLoading(planKey);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load payment. Check your internet connection."); return; }

      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }

      const options = {
        key: data.keyId,
        subscription_id: data.subscription.id,
        name: "FreelanceFlow",
        description: `${label} — ₹${price}/month`,
        handler: async (response: { razorpay_subscription_id: string }) => {
          await fetch("/api/subscription", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: response.razorpay_subscription_id, plan: planKey }),
          });
          toast.success(`You're now on the ${label} plan!`);
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
      setLoading(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-full mb-4">
          <Zap className="text-violet-600" size={24} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Choose Your Plan</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Unlock more features as your freelance business grows</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const owned = planAtLeast(currentPlan, plan.key);
          const current = currentPlan === plan.key;

          return (
            <Card key={plan.key} className={`relative border-2 ${plan.highlight ? plan.color + " shadow-xl" : plan.color}`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={16} className={plan.key === "advanced" ? "text-amber-500" : plan.key === "pro" ? "text-violet-600" : "text-blue-500"} />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{plan.label}</h2>
                </div>
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">₹{plan.price}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm mb-1">/month</span>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle size={15} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {current ? (
                  <Button disabled className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-default">
                    Current Plan
                  </Button>
                ) : owned ? (
                  <Button disabled className="w-full bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-default">
                    Included in your plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleUpgrade(plan.key, plan.price, plan.label)}
                    disabled={loading === plan.key}
                    className={`w-full text-white ${plan.key === "advanced" ? "bg-amber-500 hover:bg-amber-600" : plan.key === "pro" ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    {loading === plan.key ? "Processing..." : `Upgrade to ${plan.label}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
        All plans billed monthly via Razorpay • Cancel anytime • UPI · Cards · Netbanking
      </p>
    </div>
  );
}
