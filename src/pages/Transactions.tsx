import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Coins, Filter, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import txHero from "@/assets/transactions-hero.jpg";

interface Tx {
  id: string;
  amount: number;
  type: string;
  source: string | null;
  reference_id: string | null;
  status: string;
  created_at: string;
  meta: any;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "spin", label: "Spin" },
  { key: "scratch", label: "Scratch" },
  { key: "survey", label: "Surveys" },
  { key: "redeem", label: "Redeem" },
] as const;

const sourceLabel = (src: string | null, type: string) => {
  if (!src) return type;
  if (src === "spin") return "Spin Wheel";
  if (src === "scratch") return "Scratch Card";
  if (src === "daily_bonus") return "Daily Bonus";
  if (src === "redeem" || type === "redeem") return "Redemption";
  if (src === "upi_withdrawal") return "UPI Withdrawal";
  if (src.startsWith("giftcard:")) return `Gift Card · ${src.split(":")[1]}`;
  return src.charAt(0).toUpperCase() + src.slice(1);
};

const Transactions = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, type, source, reference_id, status, created_at, meta")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      setTxs((data ?? []) as Tx[]);
      setLoading(false);
    })();
  }, [user]);

  const filtered = txs.filter((t) => {
    if (filter === "all") return true;
    if (filter === "survey") return t.source?.includes("cpx") || t.type.includes("survey");
    if (filter === "redeem") return t.type === "redeem" || t.source?.startsWith("giftcard") || t.source === "upi_withdrawal";
    return t.source === filter;
  });

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <img
          src={txHero}
          alt="Holographic transaction ledger"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          width={1280}
          height={768}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <div className="relative flex items-center gap-3 px-5 pt-8 pb-6">
          <Link to="/wallet" className="rounded-full bg-muted/60 p-2 backdrop-blur" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Ledger 2090
            </p>
            <h1 className="text-2xl font-extrabold leading-tight">Transactions</h1>
            <p className="text-xs text-muted-foreground">Every Nova Coin in & out</p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="relative z-10 -mt-2 px-5">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-smooth border",
                filter === f.key
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "border-primary/20 bg-muted/40 text-muted-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <main className="relative z-10 mt-4 px-5 space-y-2">
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <Coins className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No transactions yet</p>
            <p className="text-[11px] text-muted-foreground">Earn Nova Coins to see them here</p>
          </div>
        )}
        {filtered.map((t) => {
          const credit = t.amount > 0;
          return (
            <article key={t.id} className="glass flex items-center gap-3 rounded-2xl p-3.5 animate-slide-up">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  credit ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                )}
              >
                {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{sourceLabel(t.source, t.type)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                  {" · "}
                  <span className="capitalize">{t.status}</span>
                </p>
              </div>
              <div className={cn("text-right font-extrabold tabular-nums", credit ? "text-success" : "text-destructive")}>
                {credit ? "+" : ""}{t.amount}
                <span className="ml-1 text-[10px] font-bold opacity-70">NC</span>
              </div>
            </article>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
};

export default Transactions;
