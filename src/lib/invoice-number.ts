import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceNumberFormat = {
  inv_prefix?: string | null;
  inv_suffix?: string | null;
  inv_separator?: string | null;
  inv_include_year?: boolean | null;
  inv_include_month?: boolean | null;
  inv_include_date?: boolean | null;
  inv_seq_digits?: number | null;
  inv_next_seq?: number | null;
};

export function formatInvoiceNumber(fmt: InvoiceNumberFormat, now: Date = new Date()): string {
  const prefix = fmt.inv_prefix ?? "INV";
  const suffix = fmt.inv_suffix ?? "";
  const sep = fmt.inv_separator ?? "-";
  const digits = fmt.inv_seq_digits ?? 4;
  const seq = fmt.inv_next_seq ?? 1;

  const parts: string[] = [];
  if (prefix) parts.push(prefix);
  if (fmt.inv_include_year !== false) parts.push(now.getFullYear().toString());
  if (fmt.inv_include_month) parts.push(String(now.getMonth() + 1).padStart(2, "0"));
  if (fmt.inv_include_date) parts.push(String(now.getDate()).padStart(2, "0"));
  parts.push(String(seq).padStart(digits, "0"));
  if (suffix) parts.push(suffix);

  return parts.join(sep);
}

export async function generateInvoiceNumber(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("inv_prefix, inv_suffix, inv_include_year, inv_include_month, inv_include_date, inv_separator, inv_seq_digits, inv_next_seq")
    .eq("id", userId)
    .single();

  const seq = (profile?.inv_next_seq as number | null) ?? 1;
  const invoiceNumber = formatInvoiceNumber(profile ?? {});
  await supabase.from("profiles").update({ inv_next_seq: seq + 1 }).eq("id", userId);
  return invoiceNumber;
}
