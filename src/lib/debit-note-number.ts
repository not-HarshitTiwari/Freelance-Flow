import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateDebitNoteNumber(supabase: SupabaseClient, userId: string): Promise<string> {
  const { count } = await supabase
    .from("debit_notes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const seq = (count ?? 0) + 1;
  return `DN-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}
