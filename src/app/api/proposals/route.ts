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

  const { projectDescription, clientName, clientEmail, clientCompany, budget, timeline } = await request.json();

  // Build sender info — only include fields that are actually set
  const senderName = profile.business_name || profile.full_name || user.email!.split("@")[0];
  const senderLines: string[] = [];
  if (profile.full_name) senderLines.push(`Name: ${profile.full_name}`);
  if (profile.business_name) senderLines.push(`Business: ${profile.business_name}`);
  if (profile.email || user.email) senderLines.push(`Email: ${profile.email || user.email}`);
  if (profile.phone) senderLines.push(`Phone: ${profile.phone}`);
  if (profile.business_address) senderLines.push(`Address: ${profile.business_address}`);
  if (profile.gstin) senderLines.push(`GSTIN: ${profile.gstin}`);
  const senderInfo = senderLines.join("\n");

  // Build client info — only include fields that are actually provided
  const clientLines: string[] = [];
  if (clientName) clientLines.push(`Name: ${clientName}`);
  if (clientCompany) clientLines.push(`Company: ${clientCompany}`);
  if (clientEmail) clientLines.push(`Email: ${clientEmail}`);
  const clientInfo = clientLines.join("\n") || "Not specified";

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: `You are a proposal writing assistant. Write a professional project proposal using ONLY the data given below. Never invent or guess any name, company, email, phone, or number not explicitly listed.

--- FREELANCER (writing this proposal) ---
${senderInfo}
--- END FREELANCER ---

--- CLIENT (receiving this proposal) ---
${clientInfo}
--- END CLIENT ---

--- PROJECT ---
Description: ${projectDescription}
Budget: ${budget ? `₹${budget}` : "To be discussed"}
Timeline: ${timeline || "To be discussed"}
--- END PROJECT ---

Write the proposal in first person with these sections:
1. Dear [exact client name from CLIENT section above, or "Sir/Madam" if not given]
2. Introduction — who you are (use exact name/business from FREELANCER section)
3. Understanding of the Project
4. Proposed Approach & Deliverables
5. Timeline
6. Pricing (use the exact budget number, or "to be discussed")
7. Why Choose [exact name from FREELANCER section]
8. Sign off with: exact full name, email, and phone from FREELANCER section

STRICT RULE: Every name, email, phone, and company in your output must come directly from the data above. If a field is not provided, omit it — do not substitute or invent.`,
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
