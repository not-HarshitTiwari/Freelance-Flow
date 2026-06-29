import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST — generate review token for a proposal
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proposalId } = await req.json();
  const token = randomBytes(32).toString("hex");

  const { error } = await supabase.from("proposals")
    .update({ review_token: token })
    .eq("id", proposalId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}

// GET — fetch proposal by review token (public)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, title, content, status, amount, created_at")
    .eq("review_token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  return NextResponse.json({ proposal: data });
}

// PATCH — client accepts or rejects
export async function PATCH(req: Request) {
  const { token, action } = await req.json();
  if (!token || !["accepted", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("proposals")
    .update({ status: action })
    .eq("review_token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
