import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);
  const supabase = await createClient();

  if (event.event === "subscription.activated") {
    const userId = event.payload.subscription.entity.notes?.user_id;
    const subscriptionId = event.payload.subscription.entity.id;

    if (userId) {
      await supabase
        .from("profiles")
        .update({ plan: "pro", razorpay_subscription_id: subscriptionId })
        .eq("id", userId);
    }
  }

  if (event.event === "subscription.cancelled" || event.event === "subscription.expired") {
    const subscriptionId = event.payload.subscription.entity.id;
    await supabase
      .from("profiles")
      .update({ plan: "free", razorpay_subscription_id: null })
      .eq("razorpay_subscription_id", subscriptionId);
  }

  return NextResponse.json({ received: true });
}
