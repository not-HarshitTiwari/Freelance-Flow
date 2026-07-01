import type { SupabaseClient } from "@supabase/supabase-js";

export function formatCreditNoteNumber(seq: number, now: Date = new Date()): string {
  return `CN-${now.getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export async function generateCreditNoteNumber(supabase: SupabaseClient, userId: string): Promise<string> {
  const { count } = await supabase
    .from("credit_notes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return formatCreditNoteNumber((count ?? 0) + 1);
}
