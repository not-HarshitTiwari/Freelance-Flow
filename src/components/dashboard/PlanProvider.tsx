"use client";

import { PlanContext, type Plan } from "@/lib/plan-context";
import { WorkspaceProvider } from "@/lib/workspace-context";

export function PlanProvider({
  plan,
  ownerId,
  isOwner,
  children,
}: {
  plan: Plan;
  ownerId: string;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return (
    <PlanContext.Provider value={plan}>
      <WorkspaceProvider ownerId={ownerId} isOwner={isOwner}>
        {children}
      </WorkspaceProvider>
    </PlanContext.Provider>
  );
}
