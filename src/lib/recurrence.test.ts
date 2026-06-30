import { describe, it, expect } from "vitest";
import { nextRecurrenceDate } from "./recurrence";

describe("nextRecurrenceDate", () => {
  const from = new Date("2026-01-15T00:00:00.000Z");

  it("adds 7 days for weekly", () => {
    const next = nextRecurrenceDate("weekly", from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-22");
  });

  it("adds 1 month for monthly", () => {
    const next = nextRecurrenceDate("monthly", from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("adds 3 months for quarterly", () => {
    const next = nextRecurrenceDate("quarterly", from);
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("defaults to monthly for unknown or missing intervals", () => {
    expect(nextRecurrenceDate(undefined, from).toISOString().slice(0, 10)).toBe("2026-02-15");
    expect(nextRecurrenceDate("bogus", from).toISOString().slice(0, 10)).toBe("2026-02-15");
  });

  it("does not mutate the input date", () => {
    const original = new Date(from);
    nextRecurrenceDate("weekly", from);
    expect(from.getTime()).toBe(original.getTime());
  });

  it("rolls over month-end correctly", () => {
    const jan31 = new Date("2026-01-31T00:00:00.000Z");
    const next = nextRecurrenceDate("monthly", jan31);
    // JS Date rolls Jan 31 + 1 month into early March since Feb has no 31st
    expect(next.getUTCMonth()).toBe(2);
  });
});
