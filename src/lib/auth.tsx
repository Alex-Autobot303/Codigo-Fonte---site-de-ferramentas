import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = { user: User | null; isAdmin: boolean; loading: boolean };
const Ctx = createContext<AuthState>({ user: null, isAdmin: false, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, loading: true });

  useEffect(() => {
    let active = true;
    const load = async (user: User | null) => {
      let isAdmin = false;
      if (user) {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        isAdmin = !!data;
      }
      if (active) setState({ user, isAdmin, loading: false });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      setTimeout(() => load(session?.user ?? null), 0);
    });
    supabase.auth.getUser().then(({ data }) => load(data.user ?? null));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
