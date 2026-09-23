import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type SecurityState = "calm" | "risk" | "paused" | "verifying" | "verified";

interface SecurityStateContextValue {
  state: SecurityState;
  setState: (s: SecurityState) => void;
}

const SecurityStateContext = createContext<SecurityStateContextValue | undefined>(undefined);

/** Drives AnimatedBackground's visual intensity/palette from wherever the
 * app currently is in the DETECT -> PAUSE -> VERIFY -> DECIDE story, so the
 * background communicates state rather than existing purely for decoration. */
export function SecurityStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SecurityState>("calm");
  const value = useMemo(() => ({ state, setState }), [state]);
  return <SecurityStateContext.Provider value={value}>{children}</SecurityStateContext.Provider>;
}

export function useSecurityState() {
  const ctx = useContext(SecurityStateContext);
  if (!ctx) throw new Error("useSecurityState must be used within SecurityStateProvider");
  return ctx;
}
