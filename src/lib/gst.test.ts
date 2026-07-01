import { describe, it, expect } from "vitest";
import { calculateGst } from "./gst";

describe("calculateGst", () => {
  const items = [
    { quantity: 2, rate: 100 },
    { quantity: 1, rate: 50 },
  ];

  it("computes subtotal as sum of quantity * rate", () => {
    const result = calculateGst(items, "none", 0);
    expect(result.subtotal).toBe(250);
    expect(result.total).toBe(250);
  });

  it("splits cgst/sgst evenly for cgst_sgst type", () => {
    const result = calculateGst(items, "cgst_sgst", 18);
    expect(result.totalGst).toBeCloseTo(45);
    expect(result.cgst).toBeCloseTo(22.5);
    expect(result.sgst).toBeCloseTo(22.5);
    expect(result.igst).toBe(0);
    expect(result.total).toBeCloseTo(295);
  });

  it("puts the full gst amount in igst for igst type", () => {
    const result = calculateGst(items, "igst", 18);
    expect(result.igst).toBeCloseTo(45);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  it("treats a missing or zero gst_rate as no tax", () => {
    const result = calculateGst(items, "cgst_sgst", null);
    expect(result.totalGst).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.total).toBe(250);
  });

  it("returns zero subtotal for an empty items list", () => {
    const result = calculateGst([], "igst", 18);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });
});
