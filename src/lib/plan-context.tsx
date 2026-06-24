"use client";

import { createContext, useContext } from "react";

export const PlanContext = createContext<"free" | "pro">("free");
export const usePlan = () => useContext(PlanContext);
