import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { isWhatsAppCloudConfigured, sendWhatsAppText, buildWaMeLink } from "@/lib/whatsapp";
import { randomBytes } from "crypto";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const { quoteId } = await request.json();
  if (!quoteId) return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });

  const [{ data: quote }, { data: profile }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).eq("user_id", ownerId).single(),
    supabase.from("profiles").select("business_name, full_name").eq("id", ownerId).single(),
  ]);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  let reviewToken = quote.review_token as string | null;
  if (!reviewToken) {
    reviewToken = randomBytes(32).toString("hex");
    await supabase.from("quotes").update({ review_token: reviewToken, status: "sent" }).eq("id", quoteId);
  }

  const senderName = profile?.business_name || profile?.full_name || "FreelanceFlow";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = `${appUrl}/quote/${reviewToken}`;
  const message = `Hi ${quote.customer_name || "there"}, please review your quote ${quote.quote_number} for ₹${quote.total.toLocaleString("en-IN")} from ${senderName}: ${link}`;

  if (!isWhatsAppCloudConfigured() || !quote.customer_phone) {
    return NextResponse.json({ fallback: true, link: buildWaMeLink(quote.customer_phone, message) });
  }

  const result = await sendWhatsAppText(quote.customer_phone, message);
  if (!result.ok) {
    return NextResponse.json({ fallback: true, link: buildWaMeLink(quote.customer_phone, message) });
  }

  return NextResponse.json({ success: true });
}
