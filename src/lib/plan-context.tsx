"use client";

import { createContext, useContext } from "react";

export type Plan = "free" | "basic" | "pro" | "advanced";

const PLAN_RANK: Record<Plan, number> = { free: 0, basic: 1, pro: 2, advanced: 3 };

export function planAtLeast(current: Plan, required: Plan): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export const PlanContext = createContext<Plan>("free");
export const usePlan = () => useContext(PlanContext);
