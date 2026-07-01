import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { nextRecurrenceDate } from "@/lib/recurrence";

// Vercel cron calls this every day at 4am IST
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: recurringExpenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("is_recurring", true)
    .lte("next_expense_date", today)
    .not("next_expense_date", "is", null);

  if (!recurringExpenses?.length) return NextResponse.json({ created: 0 });

  let created = 0;

  for (const exp of recurringExpenses) {
    const { error } = await supabase.from("expenses").insert({
      user_id: exp.user_id,
      title: exp.title,
      amount: exp.amount,
      category: exp.category,
      date: today,
      notes: exp.notes,
      is_recurring: false,
    });

    if (!error) {
      const next = nextRecurrenceDate(exp.recurrence_interval, new Date());

      await supabase.from("expenses")
        .update({ next_expense_date: next.toISOString().slice(0, 10) })
        .eq("id", exp.id);

      created++;
    }
  }

  return NextResponse.json({ created });
}
