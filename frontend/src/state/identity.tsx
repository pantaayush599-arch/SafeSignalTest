import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DemoIdentity } from "../api/types";

const STORAGE_KEY = "safesignal.identity";

interface IdentityContextValue {
  identity: DemoIdentity | null;
  setIdentity: (identity: DemoIdentity | null) => void;
}

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

function readStored(): DemoIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoIdentity) : null;
  } catch {
    return null;
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentityState] = useState<DemoIdentity | null>(() => readStored());

  const setIdentity = useCallback((next: DemoIdentity | null) => {
    setIdentityState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private-mode / blocked storage: identity still works for this tab via state */
    }
  }, []);

  useEffect(() => {
    // keep tabs in sync if the persona is switched in another tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIdentityState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ identity, setIdentity }), [identity, setIdentity]);
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within IdentityProvider");
  return ctx;
}
