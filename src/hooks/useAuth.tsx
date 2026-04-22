import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFp } from "@/lib/deviceFp";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

const applyPendingReferral = async () => {
  const code = localStorage.getItem("pending_ref");
  if (!code) return;
  try {
    const fp = getDeviceFp();
    const { data, error } = await supabase.rpc("apply_referral_code", { p_code: code, p_device_fp: fp });
    if (error) return;
    const res = data as any;
    // Always clear after attempt — success or expected failure (already_referred, self, device_used).
    // This prevents retry loops on every login.
    localStorage.removeItem("pending_ref");
    if (res?.success) {
      // toast import would create circular; rely on Refer page UI.
      // eslint-disable-next-line no-console
      console.log("Referral linked:", res.message);
    }
  } catch {
    // ignore
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up the listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      // Apply pending referral code (deferred to avoid blocking auth callback)
      if (newSession?.user) {
        setTimeout(() => applyPendingReferral(), 0);
      }
    });

    // 2. THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
