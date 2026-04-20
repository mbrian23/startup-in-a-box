"use client";

import { createContext, useContext, type ReactNode } from "react";

type SessionResetValue = {
  reset: () => void;
  /** Active thread id — rotates on reset. Use as a resetKey for hooks. */
  threadId: string;
};

const SessionResetContext = createContext<SessionResetValue | null>(null);

export function SessionResetProvider({
  reset,
  threadId,
  children,
}: {
  reset: () => void;
  threadId: string;
  children: ReactNode;
}) {
  return (
    <SessionResetContext.Provider value={{ reset, threadId }}>
      {children}
    </SessionResetContext.Provider>
  );
}

export function useSessionReset(): SessionResetValue {
  const ctx = useContext(SessionResetContext);
  if (!ctx) {
    throw new Error("useSessionReset must be used within SessionResetProvider");
  }
  return ctx;
}
