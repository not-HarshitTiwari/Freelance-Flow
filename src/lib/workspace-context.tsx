"use client";

import { createContext, useContext } from "react";

interface WorkspaceContext {
  ownerId: string;
  isOwner: boolean;
}

const WorkspaceContext = createContext<WorkspaceContext>({ ownerId: "", isOwner: true });

export function WorkspaceProvider({
  ownerId,
  isOwner,
  children,
}: WorkspaceContext & { children: React.ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ ownerId, isOwner }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
