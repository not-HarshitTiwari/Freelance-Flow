import { createClient } from "@/lib/supabase/server";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID!,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: { user_id: user.id, email: user.email || "" },
    });
    return NextResponse.json({ subscription, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);
    console.error("Razorpay error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Called after successful payment to upgrade user
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscriptionId } = await request.json();

  await supabase
    .from("profiles")
    .update({ plan: "pro", razorpay_subscription_id: subscriptionId })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
