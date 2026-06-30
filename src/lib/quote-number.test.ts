import { describe, it, expect } from "vitest";
import { formatQuoteNumber } from "./quote-number";

describe("formatQuoteNumber", () => {
  it("pads the sequence to 4 digits and includes the year", () => {
    expect(formatQuoteNumber(1, new Date(2026, 0, 1))).toBe("QUO-2026-0001");
    expect(formatQuoteNumber(42, new Date(2026, 0, 1))).toBe("QUO-2026-0042");
  });

  it("does not truncate sequences beyond 4 digits", () => {
    expect(formatQuoteNumber(12345, new Date(2026, 0, 1))).toBe("QUO-2026-12345");
  });
});
