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
  const { title, amount, category, date, notes, receipt_url, is_recurring, recurrence_interval, next_expense_date } = body;

  let allowedReceiptUrl = receipt_url || null;
  const wantsRecurring = !!is_recurring;
  if (allowedReceiptUrl || wantsRecurring) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
      allowedReceiptUrl = null;
    }
    if (!profile?.plan || !["pro", "advanced"].includes(profile.plan)) {
      if (wantsRecurring) return NextResponse.json({ error: "Recurring expenses require a Pro plan or higher." }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id, title, amount: parseFloat(amount), category, date, notes: notes || null, receipt_url: allowedReceiptUrl,
      is_recurring: wantsRecurring,
      recurrence_interval: wantsRecurring ? (recurrence_interval || "monthly") : null,
      next_expense_date: wantsRecurring ? (next_expense_date || null) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, amount, category, date, notes, receipt_url, is_recurring, recurrence_interval, next_expense_date } = await req.json();

  let allowedReceiptUrl = receipt_url;
  const wantsRecurring = !!is_recurring;
  if (receipt_url || wantsRecurring) {
    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (!profile?.plan || !["basic", "pro", "advanced"].includes(profile.plan)) {
      allowedReceiptUrl = null;
    }
    if (wantsRecurring && (!profile?.plan || !["pro", "advanced"].includes(profile.plan))) {
      return NextResponse.json({ error: "Recurring expenses require a Pro plan or higher." }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = { title, amount: parseFloat(amount), category, date, notes: notes || null, receipt_url: allowedReceiptUrl ?? undefined };
  if (is_recurring !== undefined) {
    updates.is_recurring = wantsRecurring;
    updates.recurrence_interval = wantsRecurring ? (recurrence_interval || "monthly") : null;
    updates.next_expense_date = wantsRecurring ? (next_expense_date || null) : null;
  }

  const { error } = await supabase
    .from("expenses")
    .update(updates)
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
