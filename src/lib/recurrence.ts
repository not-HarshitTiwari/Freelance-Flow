export type RecurrenceInterval = "weekly" | "monthly" | "quarterly" | string | null | undefined;

export function nextRecurrenceDate(interval: RecurrenceInterval, from: Date): Date {
  const next = new Date(from);
  if (interval === "weekly") next.setDate(next.getDate() + 7);
  else if (interval === "quarterly") next.setMonth(next.getMonth() + 3);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
