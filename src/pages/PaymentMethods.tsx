import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Wallet, Building2, Star, Trash2, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

interface Method {
  id: string;
  kind: "upi" | "bank";
  upi_vpa: string | null;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  nickname: string | null;
  is_default: boolean;
  is_verified: boolean;
}

const maskAccount = (acct?: string | null) => {
  if (!acct) return "";
  const a = acct.replace(/\s+/g, "");
  if (a.length <= 4) return a;
  return "•".repeat(Math.max(0, a.length - 4)) + a.slice(-4);
};

const PaymentMethods = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [methods, setMethods] = useState<Method[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upi" | "bank">("upi");
  const [saving, setSaving] = useState(false);

  // form state
  const [vpa, setVpa] = useState("");
  const [bankName, setBankName] = useState("");
  const [holder, setHolder] = useState("");
  const [acct, setAcct] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const refresh = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setBusy(false);
    setMethods((data ?? []) as Method[]);
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetForm = () => {
    setVpa(""); setBankName(""); setHolder(""); setAcct(""); setIfsc(""); setNickname("");
  };

  const validateVpa = (v: string) => /^[\w.\-]{2,}@[\w.\-]{2,}$/.test(v.trim());
  const validateIfsc = (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase());

  const save = async () => {
    if (!user) return;
    if (tab === "upi") {
      if (!validateVpa(vpa)) return toast.error("Invalid UPI ID (e.g. name@bank)");
    } else {
      if (holder.trim().length < 2) return toast.error("Account holder name required");
      if (!/^\d{9,18}$/.test(acct)) return toast.error("Account number must be 9–18 digits");
      if (!validateIfsc(ifsc)) return toast.error("Invalid IFSC code");
      if (bankName.trim().length < 2) return toast.error("Bank name required");
    }
    setSaving(true);
    const isFirst = methods.length === 0;
    const payload =
      tab === "upi"
        ? {
            user_id: user.id, kind: "upi", upi_vpa: vpa.trim(),
            nickname: nickname.trim() || null, is_default: isFirst,
          }
        : {
            user_id: user.id, kind: "bank",
            bank_name: bankName.trim(),
            account_holder: holder.trim(),
            account_number: acct.trim(),
            ifsc_code: ifsc.trim().toUpperCase(),
            nickname: nickname.trim() || null, is_default: isFirst,
          };
    const { error } = await supabase.from("payment_methods").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment method added");
    setOpen(false);
    resetForm();
    refresh();
  };

  const setDefault = async (id: string) => {
    const prev = methods;
    setMethods((cur) => cur.map((m) => ({ ...m, is_default: m.id === id })));
    const { error } = await supabase.rpc("set_default_payment_method", { p_method_id: id });
    if (error) {
      setMethods(prev);
      toast.error("Failed to set default");
    } else {
      toast.success("Default updated");
    }
  };

  const remove = async (id: string) => {
    const prev = methods;
    setMethods((cur) => cur.filter((m) => m.id !== id));
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) {
      setMethods(prev);
      toast.error("Delete failed");
    } else {
      toast.success("Removed");
    }
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
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Withdrawals</p>
          <h1 className="text-2xl font-extrabold leading-tight">Payment Methods</h1>
        </div>
      </header>

      <main className="relative z-10 px-5 space-y-3">
        {busy && methods.length === 0 && (
          <Card className="glass p-6 text-center text-sm text-muted-foreground">Loading…</Card>
        )}

        {!busy && methods.length === 0 && (
          <Card className="glass p-8 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-bold text-sm">No payment methods yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a UPI or bank account to receive withdrawals
            </p>
          </Card>
        )}

        {methods.map((m) => (
          <Card key={m.id} className={cn("glass p-4", m.is_default && "ring-2 ring-primary/40")}>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                {m.kind === "upi" ? (
                  <Wallet className="h-5 w-5 text-primary-foreground" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">
                    {m.nickname || (m.kind === "upi" ? "UPI" : m.bank_name || "Bank")}
                  </p>
                  {m.is_default && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  )}
                  {m.is_verified && (
                    <Check className="h-3.5 w-3.5 text-success" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                  {m.kind === "upi" ? m.upi_vpa : `${maskAccount(m.account_number)} · ${m.ifsc_code}`}
                </p>
                {m.kind === "bank" && m.account_holder && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{m.account_holder}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {!m.is_default && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setDefault(m.id)}>
                  <Star className="h-3.5 w-3.5" /> Set default
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button variant="hero" size="lg" className="w-full mt-2">
              <Plus className="h-4 w-4" /> Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
            </DialogHeader>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "upi" | "bank")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="upi">UPI</TabsTrigger>
                <TabsTrigger value="bank">Bank Account</TabsTrigger>
              </TabsList>

              <TabsContent value="upi" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="vpa">UPI ID</Label>
                  <Input
                    id="vpa" placeholder="name@bank"
                    value={vpa} onChange={(e) => setVpa(e.target.value.toLowerCase())}
                    className="h-12 rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nick1">Nickname (optional)</Label>
                  <Input
                    id="nick1" placeholder="e.g. My GPay"
                    value={nickname} onChange={(e) => setNickname(e.target.value)}
                    className="h-12 rounded-2xl"
                  />
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="holder">Account holder</Label>
                  <Input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acct">Account number</Label>
                  <Input id="acct" inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ""))} className="h-12 rounded-2xl font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ifsc">IFSC code</Label>
                  <Input id="ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} maxLength={11} className="h-12 rounded-2xl font-mono uppercase" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank name</Label>
                  <Input id="bank" value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-12 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nick2">Nickname (optional)</Label>
                  <Input id="nick2" value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-12 rounded-2xl" />
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <BottomNav />
    </div>
  );
};

export default PaymentMethods;
