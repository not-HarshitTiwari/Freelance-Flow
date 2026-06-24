import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check subscription
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan !== "pro") {
    return NextResponse.json({ error: "Upgrade to Pro to generate proposals." }, { status: 403 });
  }

  const { projectDescription, clientName, budget, timeline } = await request.json();

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a professional freelance proposal writer. Write a project proposal with the following details:

Client Name: ${clientName}
Project Description: ${projectDescription}
Budget: ${budget ? `₹${budget}` : "To be discussed"}
Timeline: ${timeline || "To be discussed"}

Include: greeting, understanding of project, proposed approach, deliverables, timeline, pricing, why choose me, call to action.
Keep it professional and concise.`;

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    const { data, error } = await supabase.from("proposals").insert({
      user_id: user.id,
      title: `Proposal for ${clientName}`,
      content,
      amount: budget ? parseFloat(budget) : null,
      status: "draft",
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ proposal: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Gemini error:", message);
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
