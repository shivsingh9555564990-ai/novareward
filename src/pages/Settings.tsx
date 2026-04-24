import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Volume2, VolumeX, Bell, AlertTriangle, KeyRound, Fingerprint, Info, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { disableBiometric } from "@/lib/biometric";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const APP_VERSION = "1.0.0";

interface Prefs {
  sound_enabled: boolean;
  notif_rewards: boolean;
  notif_social: boolean;
  notif_system: boolean;
  notif_marketing: boolean;
}

const DEFAULTS: Prefs = {
  sound_enabled: true,
  notif_rewards: true,
  notif_social: true,
  notif_system: true,
  notif_marketing: false,
};

const Row = ({
  icon: Icon, title, desc, checked, onChange, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc?: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) => (
  <div className="flex items-start gap-3 py-3">
    <div className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold">{title}</p>
      {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [deletionAt, setDeletionAt] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [prefRes, profileRes] = await Promise.all([
        supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("deletion_requested_at").eq("id", user.id).maybeSingle(),
      ]);
      if (prefRes.data) {
        setPrefs({
          sound_enabled: prefRes.data.sound_enabled,
          notif_rewards: prefRes.data.notif_rewards,
          notif_social: prefRes.data.notif_social,
          notif_system: prefRes.data.notif_system,
          notif_marketing: prefRes.data.notif_marketing,
        });
      }
      if (profileRes.data?.deletion_requested_at) {
        setDeletionAt(profileRes.data.deletion_requested_at);
      }
    })();
  }, [user]);

  const update = async (patch: Partial<Prefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setBusy(true);
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setBusy(false);
    if (error) {
      toast.error("Save failed");
      setPrefs(prefs); // rollback
    }
  };

  const requestDelete = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("request_account_deletion");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const purgeAt = (data as any)?.purge_after as string | undefined;
    setDeletionAt(new Date().toISOString());
    toast.success(
      `Account deletion requested. Purge after ${purgeAt ? new Date(purgeAt).toLocaleDateString() : "30 days"}. Login again to cancel.`,
      { duration: 9000 }
    );
  };

  const cancelDelete = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_account_deletion");
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeletionAt(null);
    toast.success("Deletion cancelled — your account is safe ✅");
  };

  if (loading || !user) return null;

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative z-10 px-5 pt-10 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-xl glass flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Profile</p>
          <h1 className="text-2xl font-extrabold leading-tight">Settings</h1>
        </div>
      </header>

      <main className="relative z-10 px-5 space-y-4">
        {deletionAt && (
          <Card className="glass p-4 border-2 border-destructive/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-destructive">Account scheduled for deletion</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Requested on {new Date(deletionAt).toLocaleDateString()}. Will be permanently purged after 30 days.
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={cancelDelete} disabled={busy}>
                  Cancel deletion
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* General */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 mb-2">General</h2>
          <Card className="glass px-4 divide-y divide-border/40">
            <Row
              icon={prefs.sound_enabled ? Volume2 : VolumeX}
              title="Sound effects"
              desc="Play sounds on rewards, spins, and games"
              checked={prefs.sound_enabled}
              onChange={(v) => update({ sound_enabled: v })}
              disabled={busy}
            />
          </Card>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 mb-2">Notifications</h2>
          <Card className="glass px-4 divide-y divide-border/40">
            <Row icon={Bell} title="Reward updates" desc="Coin credits, redemption status"
              checked={prefs.notif_rewards} onChange={(v) => update({ notif_rewards: v })} disabled={busy} />
            <Row icon={Bell} title="Social" desc="Friend requests, follows, mentions"
              checked={prefs.notif_social} onChange={(v) => update({ notif_social: v })} disabled={busy} />
            <Row icon={Bell} title="System" desc="Important account & security alerts"
              checked={prefs.notif_system} onChange={(v) => update({ notif_system: v })} disabled={busy} />
            <Row icon={Bell} title="Promotions" desc="New offers, bonus campaigns"
              checked={prefs.notif_marketing} onChange={(v) => update({ notif_marketing: v })} disabled={busy} />
          </Card>
        </section>

        {/* Security */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 mb-2">Security</h2>
          <Card className="glass divide-y divide-border/40">
            <button
              onClick={() => navigate("/change-password")}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/40"
            >
              <KeyRound className="h-4 w-4 text-foreground" />
              <span className="flex-1 text-left text-sm font-semibold">Change password</span>
            </button>
            <button
              onClick={() => navigate("/debug/device")}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/40"
            >
              <Fingerprint className="h-4 w-4 text-foreground" />
              <span className="flex-1 text-left text-sm font-semibold">Device & biometric status</span>
            </button>
            <button
              onClick={() => {
                disableBiometric();
                toast.success("Biometric disabled on this device");
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-muted/40 text-destructive"
            >
              <Fingerprint className="h-4 w-4" />
              <span className="flex-1 text-left text-sm font-semibold">Forget biometric (this device)</span>
            </button>
          </Card>
        </section>

        {/* About */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 mb-2">About</h2>
          <Card className="glass p-4">
            <div className="flex items-center gap-3">
              <Info className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-semibold">App version</p>
                <p className="text-[11px] text-muted-foreground">NovaRewards Web</p>
              </div>
              <span className="text-sm font-mono text-muted-foreground">v{APP_VERSION}</span>
            </div>
          </Card>
        </section>

        {/* Danger zone */}
        {!deletionAt && (
          <section>
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-destructive/80 px-1 mb-2">Danger zone</h2>
            <Card className="glass p-4 border border-destructive/30">
              <p className="text-sm font-semibold mb-1">Delete account</p>
              <p className="text-[11px] text-muted-foreground mb-3">
                Soft-delete your account. You have 30 days to cancel by logging in again. After 30 days everything is permanently removed.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your data will be marked for deletion. You can sign back in within 30 days to cancel. After 30 days it is permanent and cannot be reversed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={requestDelete}>Yes, delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          </section>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await signOut();
            disableBiometric();
            toast.success("Logged out");
            navigate("/login");
          }}
        >
          Sign out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
