import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectDescription, clientName, budget, timeline } = await request.json();

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a professional freelance proposal writer. Write a professional project proposal with the following details:

Client Name: ${clientName}
Project Description: ${projectDescription}
Budget: ${budget ? `₹${budget}` : "To be discussed"}
Timeline: ${timeline || "To be discussed"}

Write a compelling proposal that includes:
1. A professional greeting
2. Understanding of the project
3. Proposed approach/solution
4. Deliverables
5. Timeline breakdown
6. Investment/pricing
7. Why choose me
8. Call to action

Keep it professional, concise, and persuasive. Format it nicely with clear sections.`;

  try {
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
    console.error(err);
    return NextResponse.json({ error: "Failed to generate proposal" }, { status: 500 });
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
