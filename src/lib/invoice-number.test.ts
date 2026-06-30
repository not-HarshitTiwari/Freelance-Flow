import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "./invoice-number";

describe("formatInvoiceNumber", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");

  it("defaults to INV-<year>-0001 with no profile data", () => {
    expect(formatInvoiceNumber({}, now)).toBe("INV-2026-0001");
  });

  it("uses a custom prefix and suffix", () => {
    expect(formatInvoiceNumber({ inv_prefix: "ACME", inv_suffix: "IND" }, now)).toBe("ACME-2026-0001-IND");
  });

  it("respects a custom separator", () => {
    expect(formatInvoiceNumber({ inv_separator: "/" }, now)).toBe("INV/2026/0001");
  });

  it("omits the year when inv_include_year is false", () => {
    expect(formatInvoiceNumber({ inv_include_year: false }, now)).toBe("INV-0001");
  });

  it("includes month and date when requested, zero-padded", () => {
    expect(formatInvoiceNumber({ inv_include_month: true, inv_include_date: true }, now)).toBe("INV-2026-06-30-0001");
  });

  it("pads the sequence number to inv_seq_digits", () => {
    expect(formatInvoiceNumber({ inv_seq_digits: 6, inv_next_seq: 42 }, now)).toBe("INV-2026-000042");
  });

  it("does not truncate a sequence number wider than inv_seq_digits", () => {
    expect(formatInvoiceNumber({ inv_seq_digits: 2, inv_next_seq: 12345 }, now)).toBe("INV-2026-12345");
  });
});
