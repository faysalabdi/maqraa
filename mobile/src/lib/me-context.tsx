import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeResponse } from "@maqraa/shared";
import { api } from "./api";
import { useSession } from "./auth-context";

type MeState = {
  plan: "free" | "pro";
  loaded: boolean;
  refresh: () => Promise<void>;
};

const MeContext = createContext<MeState>({ plan: "free", loaded: false, refresh: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>("/api/v1/me");
      setPlan(me.plan);
    } catch {
      // Offline or transient — keep the last known plan.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (session) refresh();
    else {
      setPlan("free");
      setLoaded(false);
    }
  }, [session, refresh]);

  return <MeContext.Provider value={{ plan, loaded, refresh }}>{children}</MeContext.Provider>;
}

export function useMe() {
  return useContext(MeContext);
}
