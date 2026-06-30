import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, amount, category, date, notes, receipt_url } = body;

  let allowedReceiptUrl = receipt_url || null;
  if (allowedReceiptUrl) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
      allowedReceiptUrl = null;
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({ user_id: user.id, title, amount: parseFloat(amount), category, date, notes: notes || null, receipt_url: allowedReceiptUrl })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, amount, category, date, notes, receipt_url } = await req.json();

  let allowedReceiptUrl = receipt_url;
  if (receipt_url) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
      allowedReceiptUrl = null;
    }
  }

  const { error } = await supabase
    .from("expenses")
    .update({ title, amount: parseFloat(amount), category, date, notes: notes || null, receipt_url: allowedReceiptUrl ?? undefined })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
