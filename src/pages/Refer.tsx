import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Share2, Users, Sparkles, Coins, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

type RefCode = { code: string; uses_count: number; total_earned: number };
type Referral = { id: string; status: string; created_at: string; credited_at: string | null; referrer_reward: number };

const Refer = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [code, setCode] = useState<RefCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: rc }, { data: rs }] = await Promise.all([
        supabase.from("referral_codes").select("code, uses_count, total_earned").eq("user_id", user.id).maybeSingle(),
        supabase.from("referrals").select("id, status, created_at, credited_at, referrer_reward").eq("referrer_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setCode(rc as RefCode | null);
      setReferrals((rs ?? []) as Referral[]);
    })();
  }, [user]);

  const link = code ? `${window.location.origin}/register?ref=${code.code}` : "";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    if (!code) return;
    const text = `Mein NovaRewards par coins kama raha hoon! Mere code se signup karo aur 25 NC welcome bonus pao: ${code.code}\n${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join NovaRewards", text, url: link }); } catch {}
    } else {
      copy(text, "Invite message");
    }
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />

      <header className="relative px-5 pt-8 flex items-center gap-3">
        <Link to="/earn" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Invite & Earn</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Refer & Earn</span></h1>
        </div>
      </header>

      <main className="relative z-10 px-4 mt-5 space-y-5">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl p-5 shadow-glow" style={{ background: "var(--gradient-primary)" }}>
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary-foreground/80">
              <Sparkles className="h-3 w-3" /> Exclusive Bonus
            </div>
            <h2 className="mt-2 text-2xl font-extrabold text-primary-foreground leading-tight">
              Invite a friend,<br />both earn instantly
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-background/20 p-3 backdrop-blur">
                <p className="text-[10px] uppercase text-primary-foreground/70">You get</p>
                <p className="text-xl font-extrabold text-primary-foreground">+50 NC</p>
              </div>
              <div className="rounded-2xl bg-background/20 p-3 backdrop-blur">
                <p className="text-[10px] uppercase text-primary-foreground/70">Friend gets</p>
                <p className="text-xl font-extrabold text-primary-foreground">+25 NC</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral code card */}
        <div className="glass rounded-3xl p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your Code</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center">
              <p className="text-2xl font-extrabold tracking-[0.3em] text-gradient-neon">{code?.code ?? "…"}</p>
            </div>
            <button
              onClick={() => code && copy(code.code, "Code")}
              className="h-14 w-14 rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center active:scale-95 transition-bounce"
              aria-label="Copy code"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={link} className="flex-1 truncate rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground outline-none" />
            <button onClick={() => copy(link, "Link")} className="rounded-xl bg-muted/60 p-2 active:scale-95"><Copy className="h-4 w-4" /></button>
          </div>
          <Button onClick={share} variant="hero" size="lg" className="w-full">
            <Share2 className="h-4 w-4" /> Share & Earn
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4">
            <Users className="h-5 w-5 text-accent" />
            <p className="mt-2 text-2xl font-extrabold">{code?.uses_count ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Friends joined</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <Coins className="h-5 w-5 text-coin" />
            <p className="mt-2 text-2xl font-extrabold text-gradient-coin">{code?.total_earned ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">NC earned</p>
          </div>
        </div>

        {/* How it works */}
        <div className="glass rounded-3xl p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" /> Fair Play Rules</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>• Ek device se sirf ek hi referral allow hai (multi-account block).</li>
            <li>• Reward tab milega jab naya friend pehli baar coins kamayega.</li>
            <li>• Khud ko refer karna allowed nahi hai.</li>
            <li>• Suspicious activity dikhne par referral cancel ho sakti hai.</li>
          </ul>
        </div>

        {/* History */}
        {referrals.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground px-1">Recent Referrals</h3>
            {referrals.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Friend joined</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                {r.status === "credited" ? (
                  <span className="rounded-full bg-success/20 px-3 py-1 text-[10px] font-bold uppercase text-success">+{r.referrer_reward} NC</span>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">Pending</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Refer;
