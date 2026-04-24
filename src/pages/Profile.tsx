import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LogOut, Mail, Coins, Fingerprint, ShieldCheck,
  Settings, Bell, Wallet as WalletIcon, KeyRound, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import SmartAvatar from "@/components/SmartAvatar";
import {
  checkBiometricSupport,
  biometricEnrolled,
  enrollBiometric,
  disableBiometric,
} from "@/lib/biometric";
import { formatRupees } from "@/lib/nova";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  phone: string | null;
}

const ProfileLink = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/40 transition-colors"
  >
    <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center">
      <Icon className="h-4 w-4 text-foreground" />
    </div>
    <span className="flex-1 text-sm font-semibold">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </button>
);

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioOn, setBioOn] = useState<boolean>(biometricEnrolled());
  const [bioBusy, setBioBusy] = useState(false);
  const bioCheck = checkBiometricSupport();
  const bioSupport = bioCheck.ok;

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
          <SmartAvatar
            src={profile?.avatar_url}
            name={profile?.full_name}
            className="h-full w-full text-4xl"
          />
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

        {/* Biometric login toggle */}
        <button
          type="button"
          onClick={toggleBiometric}
          disabled={bioBusy || !bioSupport}
          className={`w-full text-left rounded-2xl p-4 border-2 transition-bounce active:scale-[0.99] disabled:opacity-60 ${
            bioOn
              ? "border-primary/40 bg-gradient-to-br from-primary/15 via-accent/10 to-secondary/15"
              : "border-border bg-muted/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${bioOn ? "bg-gradient-primary shadow-glow" : "bg-muted"}`}>
              {bioOn ? (
                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Fingerprint className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                {bioOn ? "Biometric login ON" : "Enable Biometric login"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {!bioSupport
                  ? bioCheck.message
                  : bioOn
                  ? "Tap to disable — finger/face se auto-login"
                  : "Tap to register fingerprint / face for one-tap login"}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${bioOn ? "text-primary" : "text-muted-foreground"}`}>
              {bioBusy ? "..." : bioOn ? "ON" : "OFF"}
            </span>
          </div>
        </button>

        {/* Quick links */}
        <div className="glass rounded-2xl divide-y divide-border/40">
          {isAdmin && (
            <ProfileLink icon={ShieldCheck} label="🛡️ Admin Panel" onClick={() => navigate("/admin")} />
          )}
          <ProfileLink icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} />
          <ProfileLink icon={WalletIcon} label="Payment Methods" onClick={() => navigate("/payment-methods")} />
          <ProfileLink icon={KeyRound} label="Change Password" onClick={() => navigate("/change-password")} />
          <ProfileLink icon={Settings} label="Settings" onClick={() => navigate("/settings")} />
          <ProfileLink icon={Fingerprint} label="Device & Anti-Fraud" onClick={() => navigate("/debug/device")} />
        </div>

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
