import type { SupabaseClient } from "@supabase/supabase-js";

export type StockItem = { product_id?: string; quantity: number };

/**
 * multiplier 1 = consume stock (invoice created/items added), -1 = restock
 * (invoice deleted, items removed, or quantity reduced on edit).
 * Returns any per-item RPC errors so callers can surface a non-blocking warning.
 */
export async function applyStockChange(
  supabase: SupabaseClient,
  items: StockItem[] | null | undefined,
  multiplier: 1 | -1
): Promise<{ product_id: string; message: string }[]> {
  const errors: { product_id: string; message: string }[] = [];
  if (!items) return errors;

  for (const item of items) {
    if (!item.product_id) continue;
    const { error } = await supabase.rpc("decrement_product_stock", {
      p_id: item.product_id,
      qty: multiplier * item.quantity,
    });
    if (error) {
      console.error(`Stock adjustment failed for product ${item.product_id}:`, error.message);
      errors.push({ product_id: item.product_id, message: error.message });
    }
  }
  return errors;
}
