"use client";

import { PlanContext } from "@/lib/plan-context";

export function PlanProvider({
  plan,
  children,
}: {
  plan: "free" | "pro";
  children: React.ReactNode;
}) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}
