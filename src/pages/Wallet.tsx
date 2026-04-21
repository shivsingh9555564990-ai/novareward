import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Coins, Gift, Sparkles, TrendingUp, ChevronRight, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { formatRupees, NOVA_PER_RUPEE } from "@/lib/nova";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import walletHero from "@/assets/wallet-hero.jpg";

interface Tx {
  id: string;
  amount: number;
  type: string;
  source: string | null;
  status: string;
  created_at: string;
}

interface Pending {
  id: string;
  type: string;
  brand: string | null;
  amount_inr: number;
  coins_spent: number;
  status: string;
  created_at: string;
}

const Wallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [todayEarned, setTodayEarned] = useState(0);
  const [weekEarned, setWeekEarned] = useState(0);

  const animatedCoins = useCountUp(coins);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles").select("coins").eq("id", user.id).maybeSingle();
      setCoins(prof?.coins ?? 0);

      const { data: tx } = await supabase
        .from("transactions")
        .select("id, amount, type, source, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setRecent((tx ?? []) as Tx[]);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);

      const { data: rangeTx } = await supabase
        .from("transactions").select("amount, created_at")
        .eq("user_id", user.id)
        .gte("created_at", weekStart.toISOString());
      let t = 0, w = 0;
      (rangeTx ?? []).forEach((r) => {
        if (r.amount > 0) {
          w += r.amount;
          if (new Date(r.created_at) >= todayStart) t += r.amount;
        }
      });
      setTodayEarned(t); setWeekEarned(w);

      const { data: red } = await supabase
        .from("redemptions")
        .select("id, type, brand, amount_inr, coins_spent, status, created_at")
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false });
      setPending((red ?? []) as Pending[]);
    })();
  }, [user]);

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <img
          src={walletHero}
          alt="Nova wallet vault holographic"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
          width={1280}
          height={768}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <div className="relative px-5 pt-10 pb-7">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Nova Wallet · 2090
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">
            <span className="text-gradient-neon">Your Vault</span>
          </h1>
        </div>
      </header>

      <main className="relative z-10 px-5 -mt-4 space-y-5">
        {/* Balance card */}
        <section className="relative overflow-hidden rounded-3xl p-6 bg-gradient-primary shadow-glow">
          <div className="pointer-events-none absolute inset-x-0 h-px bg-gradient-neon opacity-70 animate-scan" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="text-primary-foreground/80 text-xs uppercase tracking-[0.2em]">Available Balance</p>
          <div className="mt-2 flex items-baseline gap-2">
            <Coins className="w-8 h-8 text-coin animate-coin-spin drop-shadow-[0_0_8px_hsl(var(--coin))]" />
            <span className="text-5xl font-extrabold text-primary-foreground tabular-nums">
              {animatedCoins.toLocaleString()}
            </span>
            <span className="text-primary-foreground/80 font-semibold">NC</span>
          </div>
          <p className="mt-1 text-primary-foreground/80 text-sm">
            ≈ {formatRupees(coins)} <span className="opacity-70">· 120 NC = ₹10</span>
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="hero" size="lg" className="flex-1 bg-coin text-coin-foreground shadow-coin hover:bg-coin/90"
              onClick={() => navigate("/redeem")}>
              <Gift className="w-4 h-4" /> Redeem
            </Button>
            <Button variant="outline" size="lg" className="flex-1 bg-background/15 border-white/20 text-primary-foreground hover:bg-background/25"
              onClick={() => navigate("/earn")}>
              Earn More
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatTile icon={TrendingUp} label="Today" value={`+${todayEarned}`} sub="NC" tint="text-success" />
          <StatTile icon={Sparkles} label="7 days" value={`+${weekEarned}`} sub="NC" tint="text-accent" />
          <StatTile icon={Clock} label="Pending" value={String(pending.length)} sub="payouts" tint="text-coin" />
        </section>

        {/* Conversion calculator */}
        <section className="glass rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Conversion</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-gradient-coin tabular-nums">
                {coins.toLocaleString()} NC
              </p>
              <p className="text-[11px] text-muted-foreground">your balance</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-right">
              <p className="text-2xl font-extrabold text-foreground tabular-nums">
                ₹{(coins / NOVA_PER_RUPEE).toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground">withdrawable</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-gradient-neon" style={{ width: `${Math.min(100, (coins / 1200) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {coins >= 1200 ? "✓ Min UPI withdrawal unlocked" : `${1200 - coins} NC to unlock UPI withdrawal (₹100)`}
          </p>
        </section>

        {/* Pending payouts */}
        {pending.length > 0 && (
          <section>
            <h2 className="mb-2 text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-coin" /> Pending Payouts
            </h2>
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                  <div className="h-9 w-9 rounded-xl bg-coin/15 text-coin flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">
                      {p.type === "upi" ? "UPI Withdrawal" : `Gift Card · ${p.brand}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      ₹{p.amount_inr} · {new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <span className="rounded-full bg-coin/15 px-2 py-1 text-[10px] font-bold uppercase text-coin">
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent transactions */}
        <section>
          <div className="mb-2 flex items-end justify-between">
            <h2 className="text-base font-bold">Recent Activity</h2>
            <Link to="/transactions" className="text-xs font-semibold text-primary">View all</Link>
          </div>
          <div className="space-y-2">
            {recent.length === 0 && (
              <div className="glass rounded-2xl p-6 text-center">
                <p className="text-sm text-muted-foreground">No activity yet — earn your first Nova Coins!</p>
              </div>
            )}
            {recent.map((t) => {
              const credit = t.amount > 0;
              return (
                <div key={t.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                  <div className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center",
                    credit ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  )}>
                    {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold capitalize truncate">
                      {(t.source || t.type).replace(/[:_]/g, " ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className={cn("text-right font-extrabold text-sm tabular-nums", credit ? "text-success" : "text-destructive")}>
                    {credit ? "+" : ""}{t.amount}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value, sub, tint }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; tint: string;
}) => (
  <div className="glass rounded-2xl p-3">
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3.5 h-3.5", tint)} />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
    </div>
    <p className="mt-1 text-base font-extrabold">{value}</p>
    <p className="text-[10px] text-muted-foreground">{sub}</p>
  </div>
);

export default Wallet;
