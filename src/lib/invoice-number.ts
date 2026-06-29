import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateInvoiceNumber(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("inv_prefix, inv_suffix, inv_include_year, inv_include_month, inv_include_date, inv_separator, inv_seq_digits, inv_next_seq")
    .eq("id", userId)
    .single();

  const prefix = (profile?.inv_prefix as string | null) ?? "INV";
  const suffix = (profile?.inv_suffix as string | null) ?? "";
  const sep = (profile?.inv_separator as string | null) ?? "-";
  const digits = (profile?.inv_seq_digits as number | null) ?? 4;
  const seq = (profile?.inv_next_seq as number | null) ?? 1;
  const now = new Date();

  const parts: string[] = [prefix];
  if ((profile?.inv_include_year as boolean | null) !== false) parts.push(now.getFullYear().toString());
  if (profile?.inv_include_month) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  if (profile?.inv_include_date) parts.push(String(now.getDate()).padStart(2, "0"));
  parts.push(String(seq).padStart(digits, "0"));
  if (suffix) parts.push(suffix);

  const invoiceNumber = parts.join(sep);
  await supabase.from("profiles").update({ inv_next_seq: seq + 1 }).eq("id", userId);
  return invoiceNumber;
}
