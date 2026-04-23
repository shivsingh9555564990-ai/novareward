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
    localStorage.removeItem("pending_ref");
    if (res?.success) {
      // eslint-disable-next-line no-console
      console.log("Referral linked:", res.message);
    }
  } catch {
    // ignore
  }
};

const maskEmail = (email?: string | null) => {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

const registerDevice = async (user: User) => {
  try {
    const fp = getDeviceFp();
    const hint = maskEmail(user.email);
    await supabase.rpc("register_device_signup", { p_device_fp: fp, p_email_hint: hint });
  } catch {
    // ignore — non-critical
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
      // Apply pending referral + register device (deferred to avoid blocking auth callback)
      if (newSession?.user) {
        const u = newSession.user;
        setTimeout(() => {
          applyPendingReferral();
          registerDevice(u);
        }, 0);
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
