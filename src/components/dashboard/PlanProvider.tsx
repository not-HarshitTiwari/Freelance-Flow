"use client";

import { PlanContext, type Plan } from "@/lib/plan-context";

export function PlanProvider({ plan, children }: { plan: Plan; children: React.ReactNode }) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}
