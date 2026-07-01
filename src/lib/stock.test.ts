import { describe, it, expect, vi } from "vitest";
import { applyStockChange } from "./stock";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(rpcResults: Record<string, { error: { message: string } | null }>) {
  return {
    rpc: vi.fn((_fn: string, args: { p_id: string; qty: number }) =>
      Promise.resolve(rpcResults[args.p_id] ?? { error: null })
    ),
  } as unknown as SupabaseClient;
}

describe("applyStockChange", () => {
  it("returns no errors and skips the RPC for null/undefined items", async () => {
    const supabase = mockSupabase({});
    expect(await applyStockChange(supabase, undefined, 1)).toEqual([]);
    expect(await applyStockChange(supabase, null, 1)).toEqual([]);
    expect((supabase.rpc as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("skips items without a product_id", async () => {
    const supabase = mockSupabase({});
    const errors = await applyStockChange(supabase, [{ quantity: 5 }], 1);
    expect(errors).toEqual([]);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls decrement_product_stock with quantity * multiplier for consumption", async () => {
    const supabase = mockSupabase({});
    await applyStockChange(supabase, [{ product_id: "p1", quantity: 3 }], 1);
    expect(supabase.rpc).toHaveBeenCalledWith("decrement_product_stock", { p_id: "p1", qty: 3 });
  });

  it("negates the quantity for restock (multiplier -1)", async () => {
    const supabase = mockSupabase({});
    await applyStockChange(supabase, [{ product_id: "p1", quantity: 3 }], -1);
    expect(supabase.rpc).toHaveBeenCalledWith("decrement_product_stock", { p_id: "p1", qty: -3 });
  });

  it("collects per-item errors without aborting the rest of the batch", async () => {
    const supabase = mockSupabase({
      bad: { error: { message: "insufficient stock" } },
    });
    const errors = await applyStockChange(
      supabase,
      [
        { product_id: "good", quantity: 1 },
        { product_id: "bad", quantity: 1 },
      ],
      1
    );
    expect(errors).toEqual([{ product_id: "bad", message: "insufficient stock" }]);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});
