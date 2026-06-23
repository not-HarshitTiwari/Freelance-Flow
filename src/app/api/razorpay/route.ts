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
    // Create a Razorpay subscription plan (₹999/month)
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID!,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: {
        user_id: user.id,
        email: user.email || "",
      },
    });

    return NextResponse.json({ subscription });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
