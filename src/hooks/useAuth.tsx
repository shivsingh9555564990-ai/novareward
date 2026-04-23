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
  if (user.length <= 2) return email;

  const head = user.slice(0, 2);
  if (user.length <= 7) {
    return `${head}${user.slice(2)}@${domain}`;
  }

  const tail = user.slice(-5);
  const maskedLen = Math.max(1, user.length - 7);
  return `${head}${"*".repeat(maskedLen)}${tail}@${domain}`;
};

/**
 * Enforce one-device = one-account.
 * Returns { blocked: true, emailHint } if the device already belongs
 * to another account, otherwise registers/links the device.
 */
const enforceDeviceLink = async (
  user: User
): Promise<{ blocked: boolean; emailHint: string | null }> => {
  try {
    const fp = getDeviceFp();
    const hint = maskEmail(user.email);
    const { data, error } = await supabase.rpc("enforce_device_single_account", {
      p_device_fp: fp,
      p_email_hint: hint,
    });
    if (error) return { blocked: false, emailHint: null };
    const res = data as any;
    if (res?.status === "blocked") {
      return { blocked: true, emailHint: res.email_hint ?? null };
    }
    return { blocked: false, emailHint: null };
  } catch {
    return { blocked: false, emailHint: null };
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
      // Enforce one-device-one-account; apply pending referral if allowed.
      if (newSession?.user) {
        const u = newSession.user;
        setTimeout(async () => {
          const check = await enforceDeviceLink(u);
          if (check.blocked) {
            // Sign the freshly-created account out and bounce to login with a clear message.
            await supabase.auth.signOut();
            const params = new URLSearchParams({ device_blocked: "1" });
            if (check.emailHint) params.set("email_hint", check.emailHint);
            // Use replace to avoid back-button returning to a half-authed state.
            window.location.replace(`/login?${params.toString()}`);
            return;
          }
          applyPendingReferral();
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
