import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFp, resetDeviceFp } from "@/lib/deviceFp";
import {
  checkBiometricSupport,
  platformAuthenticatorAvailable,
  biometricEnrolled,
  biometricCredentialId,
  biometricEmailHint,
} from "@/lib/biometric";
import { toast } from "sonner";
import { ArrowLeft, Copy, Fingerprint, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface DeviceStatus {
  status: string;
  fp?: string;
  my_user_id?: string;
  my_email_hint?: string | null;
  device_rows?: number;
  owner_user_id?: string | null;
  owner_email_hint?: string | null;
  i_am_owner?: boolean;
  i_am_linked?: boolean;
  would_be_blocked?: boolean;
}

const Row = ({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={`text-sm text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

const DebugDevice = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [fp, setFp] = useState<string>("");
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const refresh = async () => {
    if (!user) return;
    setBusy(true);
    const current = getDeviceFp();
    setFp(current);
    const { data, error } = await supabase.rpc("get_my_device_status", { p_device_fp: current });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStatus(data as unknown as DeviceStatus);
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const copyFp = async () => {
    try {
      await navigator.clipboard.writeText(fp);
      toast.success("Fingerprint copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const regenerate = () => {
    const next = resetDeviceFp();
    setFp(next);
    toast.success("Local fingerprint reset");
    refresh();
  };

  if (loading || !user) return null;

  const blocked = !!status?.would_be_blocked;
  const linked = !!status?.i_am_linked;

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
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Debug</p>
          <h1 className="text-2xl font-extrabold leading-tight">Device & Anti-Fraud</h1>
        </div>
      </header>

      <main className="relative z-10 px-5 space-y-4">
        {/* Status banner */}
        <Card className={`glass p-4 border-2 ${blocked ? "border-destructive/50" : linked ? "border-primary/40" : "border-accent/30"}`}>
          <div className="flex items-center gap-3">
            {blocked ? (
              <ShieldAlert className="h-8 w-8 text-destructive flex-shrink-0" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-primary flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                {blocked
                  ? "Device blocked for new accounts"
                  : linked
                  ? "Device linked to your account"
                  : "Device available"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {blocked
                  ? `Original owner: ${status?.owner_email_hint || "—"}`
                  : "Anti-fraud rule passing"}
              </p>
            </div>
          </div>
        </Card>

        {/* Fingerprint card */}
        <Card className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Browser Fingerprint</h2>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs break-all">
            {fp || "—"}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" onClick={copyFp} className="flex-1">
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={refresh} disabled={busy} className="flex-1">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={regenerate} className="flex-1">
              Reset
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Stored in <span className="font-mono">localStorage</span> as <span className="font-mono">nova_device_fp_v2</span>.
            Resetting only clears your local copy — backend records stay.
          </p>
        </Card>

        {/* Backend status */}
        <Card className="glass p-4">
          <h2 className="text-sm font-bold mb-2">Backend Match</h2>
          {status ? (
            <div>
              <Row
                label="Status"
                value={<Badge variant={blocked ? "destructive" : "secondary"}>{status.status}</Badge>}
              />
              <Row label="My email hint" value={status.my_email_hint || "—"} />
              <Row label="Device rows" value={status.device_rows ?? 0} />
              <Row label="Owner email hint" value={status.owner_email_hint || "—"} />
              <Row
                label="I am owner"
                value={status.i_am_owner ? "Yes ✅" : "No"}
              />
              <Row
                label="I am linked"
                value={status.i_am_linked ? "Yes ✅" : "No"}
              />
              <Row
                label="New signup blocked"
                value={status.would_be_blocked ? "Yes 🚫" : "No ✅"}
              />
              <Row label="My user id" value={status.my_user_id || "—"} mono />
              <Row label="Owner user id" value={status.owner_user_id || "—"} mono />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </Card>

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Use this page to verify the one-device-one-account rule.
        </p>
      </main>

      <BottomNav />
    </div>
  );
};

export default DebugDevice;
