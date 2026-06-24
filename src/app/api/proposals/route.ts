import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, full_name, business_name, business_address, email, phone, gstin")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "Upgrade to Pro to generate proposals." }, { status: 403 });
  }

  const { projectDescription, clientName, clientEmail, clientCompany, budget, timeline } = await request.json();

  const senderName = profile.business_name || profile.full_name || "I";
  const senderInfo = [
    profile.business_name && `Business: ${profile.business_name}`,
    profile.business_address && `Location: ${profile.business_address}`,
    profile.gstin && `GSTIN: ${profile.gstin}`,
  ].filter(Boolean).join("\n");

  const clientInfo = [
    clientName && `Name: ${clientName}`,
    clientCompany && `Company: ${clientCompany}`,
    clientEmail && `Email: ${clientEmail}`,
  ].filter(Boolean).join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `You are writing a professional freelance project proposal. Write it in first person from the freelancer's perspective.

Freelancer/Sender Info:
${senderInfo || `Name: ${senderName}`}

Client Info:
${clientInfo}

Project Description: ${projectDescription}
Budget: ${budget ? `₹${budget}` : "To be discussed"}
Timeline: ${timeline || "To be discussed"}

Structure the proposal with these sections:
1. Greeting & Introduction
2. Understanding of the Project
3. Proposed Approach & Deliverables
4. Timeline
5. Pricing
6. Why Choose ${senderName}
7. Call to Action / Next Steps

Keep it professional, concise, and persuasive. Address the client by name if provided.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";

    const { data, error } = await supabase.from("proposals").insert({
      user_id: user.id,
      title: `Proposal for ${clientName}${clientCompany ? ` (${clientCompany})` : ""}`,
      content,
      amount: budget ? parseFloat(budget) : null,
      status: "draft",
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ proposal: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("Groq error:", message);
    return NextResponse.json({ error: `Failed to generate proposal: ${message}` }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("proposals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ proposals: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, content, status } = await request.json();
  const update: Record<string, string> = {};
  if (content !== undefined) update.content = content;
  if (status !== undefined) update.status = status;

  const { data, error } = await supabase
    .from("proposals")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposal: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json();
  const { error } = await supabase.from("proposals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
