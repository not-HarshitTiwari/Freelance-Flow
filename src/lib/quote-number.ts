import type { SupabaseClient } from "@supabase/supabase-js";

export function formatQuoteNumber(seq: number, now: Date = new Date()): string {
  return `QUO-${now.getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export async function generateQuoteNumber(supabase: SupabaseClient, userId: string): Promise<string> {
  const { count } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return formatQuoteNumber((count ?? 0) + 1);
}
