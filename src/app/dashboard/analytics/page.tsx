import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "@/components/dashboard/AnalyticsClient";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: rawInvoices }, { data: rawExpenses }, { data: profile }] = await Promise.all([
    supabase
      .from("invoices")
      .select("total, status, invoice_date, created_at, customer_name, customer_company, amount_paid")
      .eq("user_id", user.id),
    supabase.from("expenses").select("amount, date, category").eq("user_id", user.id),
    supabase.from("profiles").select("plan").eq("id", user.id).single(),
  ]);

  return (
    <AnalyticsClient
      invoices={rawInvoices ?? []}
      expenses={rawExpenses ?? []}
      isFree={(profile?.plan || "free") === "free"}
    />
  );
}
