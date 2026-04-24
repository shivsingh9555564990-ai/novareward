import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, Coins, Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import SmartAvatar from "@/components/SmartAvatar";
import {
  biometricSupported,
  biometricEnrolled,
  enrollBiometric,
  disableBiometric,
} from "@/lib/biometric";
import { formatRupees } from "@/lib/nova";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  phone: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioOn, setBioOn] = useState<boolean>(biometricEnrolled());
  const [bioBusy, setBioBusy] = useState(false);
  const bioSupport = biometricSupported();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url, coins, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => data && setProfile(data));
  }, [user]);

  const toggleBiometric = async () => {
    if (!bioSupport) {
      toast.error("Is browser/device pe biometric support nahi hai");
      return;
    }
    setBioBusy(true);
    try {
      if (bioOn) {
        disableBiometric();
        setBioOn(false);
        toast.success("Biometric login disabled");
      } else {
        await enrollBiometric();
        setBioOn(true);
        toast.success("✅ Biometric enabled — ab finger se login hoga");
      }
    } catch (err: any) {
      toast.error(err?.message || "Biometric setup failed");
    } finally {
      setBioBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />

      <header className="relative z-10 px-6 pt-10 pb-6 text-center">
        <div className="mx-auto h-24 w-24 rounded-full bg-gradient-primary p-[3px] shadow-glow animate-pulse-glow">
          <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-4xl">
            {profile?.avatar_url || "👤"}
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">
          {profile?.full_name || "Nova Explorer"}
        </h1>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
          <Mail className="w-3.5 h-3.5" /> {user.email}
        </p>
      </header>

      <main className="relative z-10 px-5 space-y-4">
        <div className="rounded-3xl glass p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-coin flex items-center justify-center shadow-coin">
            <Coins className="w-6 h-6 text-coin-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Nova Balance</p>
            <p className="font-extrabold text-lg">
              {(profile?.coins ?? 0).toLocaleString()} NC
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatRupees(profile?.coins ?? 0)}
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/debug/device")}
        >
          <Fingerprint className="w-4 h-4" /> Device & Anti-Fraud
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await signOut();
            toast.success("Logged out");
            navigate("/login");
          }}
        >
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;
