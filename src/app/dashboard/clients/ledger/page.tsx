import { createClient } from "@/lib/supabase/server";
import { getWorkspaceOwnerId } from "@/lib/team";
import { redirect } from "next/navigation";
import { ClientLedgerClient } from "@/components/dashboard/ClientLedgerClient";

export default async function ClientLedgerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const ownerId = await getWorkspaceOwnerId(supabase, user.id);

  const [{ data: clients }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("clients").select("id, name, email, phone, company").eq("user_id", ownerId).order("name"),
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total, amount_paid, status, customer_name, customer_email, customer_company")
      .eq("user_id", ownerId),
    supabase.from("payments").select("id, invoice_id, amount, note, paid_at").eq("user_id", ownerId),
  ]);

  return (
    <ClientLedgerClient
      clients={clients ?? []}
      invoices={invoices ?? []}
      payments={payments ?? []}
    />
  );
}
