import { createClient } from "@/lib/supabase/server";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { getWorkspaceOwnerId, getWorkspaceRole, canWrite } from "@/lib/team";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, full_name, business_name, business_address, email, phone, gstin, ai_proposals_count, ai_proposals_reset_at")
    .eq("id", ownerId)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Server-side monthly quota — the ad-watch flow is client-only and can't be verified here,
  // so this is a hard ceiling per plan to cap Groq spend regardless of claimed ad views.
  const MONTHLY_CAP: Record<string, number | null> = { free: 15, basic: 20, pro: 70, advanced: null };
  const plan = profile.plan || "free";
  const cap = MONTHLY_CAP[plan] ?? 15;

  if (cap !== null) {
    const today = new Date();
    const resetAt = profile.ai_proposals_reset_at ? new Date(profile.ai_proposals_reset_at) : null;
    const isNewMonth = !resetAt || resetAt.getFullYear() !== today.getFullYear() || resetAt.getMonth() !== today.getMonth();
    const currentCount = isNewMonth ? 0 : (profile.ai_proposals_count ?? 0);

    if (currentCount >= cap) {
      return NextResponse.json({ error: `Monthly AI proposal limit (${cap}) reached for your plan. Upgrade for a higher limit.` }, { status: 403 });
    }

    await supabase.from("profiles").update({
      ai_proposals_count: currentCount + 1,
      ai_proposals_reset_at: today.toISOString().slice(0, 10),
    }).eq("id", ownerId);
  }

  const { projectDescription, clientName, clientEmail, clientCompany, budget, timeline } = await request.json();

  // Build sender info — only include fields that are actually set (uses owner's business identity)
  const ownerEmail = profile.email || user.email;
  const senderName = profile.business_name || profile.full_name || user.email!.split("@")[0];
  const senderLines: string[] = [];
  if (profile.full_name) senderLines.push(`Name: ${profile.full_name}`);
  if (profile.business_name) senderLines.push(`Business: ${profile.business_name}`);
  if (ownerEmail) senderLines.push(`Email: ${ownerEmail}`);
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
      user_id: ownerId,
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

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const { data } = await supabase
    .from("proposals")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ proposals: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });

  const { id, content, status } = await request.json();
  const update: Record<string, string> = {};
  if (content !== undefined) update.content = content;
  if (status !== undefined) update.status = status;

  const { data, error } = await supabase
    .from("proposals")
    .update(update)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposal: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);
  const role = await getWorkspaceRole(supabase, user.id);
  if (!canWrite(role)) return NextResponse.json({ error: "Your role doesn't allow this action." }, { status: 403 });
  const { id } = await request.json();
  const { error } = await supabase.from("proposals").delete().eq("id", id).eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
