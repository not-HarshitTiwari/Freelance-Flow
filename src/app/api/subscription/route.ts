import { createClient } from "@/lib/supabase/server";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const PLAN_IDS: Record<string, string | undefined> = {
  basic: process.env.RAZORPAY_BASIC_PLAN_ID,
  pro: process.env.RAZORPAY_PRO_PLAN_ID || process.env.RAZORPAY_PLAN_ID,
  advanced: process.env.RAZORPAY_ADVANCED_PLAN_ID,
};

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic Plan — ₹499/month",
  pro: "Pro Plan — ₹999/month",
  advanced: "Advanced Plan — ₹1999/month",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan: string = body.plan || "pro";

  const planId = PLAN_IDS[plan];
  if (!planId) {
    return NextResponse.json({ error: `No Razorpay plan configured for "${plan}". Add RAZORPAY_${plan.toUpperCase()}_PLAN_ID to your environment.` }, { status: 400 });
  }

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: { user_id: user.id, email: user.email || "", plan },
    });
    return NextResponse.json({ subscription, keyId: process.env.RAZORPAY_KEY_ID, plan, label: PLAN_LABELS[plan] });
  } catch (err) {
    const message = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscriptionId, plan } = await request.json();
  const validPlan = ["basic", "pro", "advanced"].includes(plan) ? plan : "pro";

  await supabase
    .from("profiles")
    .update({ plan: validPlan, razorpay_subscription_id: subscriptionId })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
