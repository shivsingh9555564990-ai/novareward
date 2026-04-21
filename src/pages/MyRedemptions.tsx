import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Copy, Gift, History, Smartphone, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Redemption = {
  id: string;
  type: string;
  brand: string | null;
  amount_inr: number;
  coins_spent: number;
  status: string;
  upi_id: string | null;
  voucher_code: string | null;
  voucher_pin: string | null;
  delivery_method: string;
  created_at: string;
  delivered_at: string | null;
  expires_at: string | null;
};

type Filter = "all" | "completed" | "pending" | "expired";
type Sort = "newest" | "oldest";

const MyRedemptions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("redemptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as Redemption[]);
      setLoading(false);
    })();
  }, [user]);

  const visible = useMemo(() => {
    let list = items;
    const now = Date.now();
    if (filter === "expired") list = list.filter((r) => r.expires_at && new Date(r.expires_at).getTime() < now);
    else if (filter !== "all") list = list.filter((r) => r.status === filter);
    return [...list].sort((a, b) => {
      const da = +new Date(a.created_at), db = +new Date(b.created_at);
      return sort === "newest" ? db - da : da - db;
    });
  }, [items, filter, sort]);

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copied!");
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <button onClick={() => navigate("/redeem")} className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">My Vouchers</p>
          <h1 className="text-2xl font-extrabold">Redemptions</h1>
        </div>
      </header>

      <div className="px-5 mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {(["all", "completed", "pending", "expired"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-smooth border shrink-0", filter === f ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "border-primary/20 bg-muted/30 text-muted-foreground")}>{f}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-primary/20 bg-muted/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground outline-none">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <main className="relative z-10 mt-5 px-4 space-y-3">
        {loading ? (
          [0, 1, 2].map((i) => <div key={i} className="glass h-28 animate-pulse rounded-2xl" />)
        ) : visible.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
            <Button variant="hero" size="sm" className="mt-4" onClick={() => navigate("/redeem")}>Redeem Now</Button>
          </div>
        ) : (
          visible.map((r) => <RedemptionCard key={r.id} r={r} onCopy={copy} />)
        )}
      </main>

      <BottomNav />
    </div>
  );
};

const RedemptionCard = ({ r, onCopy }: { r: Redemption; onCopy: (s: string) => void }) => {
  const isUpi = r.type === "upi";
  const expired = r.expires_at && new Date(r.expires_at).getTime() < Date.now();
  const status = expired ? "expired" : r.status;

  const statusMap: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    completed: { color: "bg-success/20 text-success border-success/40", icon: <CheckCircle2 className="h-3 w-3" />, label: "Delivered" },
    pending: { color: "bg-coin/20 text-coin border-coin/40", icon: <Clock className="h-3 w-3 animate-pulse" />, label: "Pending" },
    rejected: { color: "bg-destructive/20 text-destructive border-destructive/40", icon: <XCircle className="h-3 w-3" />, label: "Rejected" },
    expired: { color: "bg-muted text-muted-foreground border-border", icon: <Clock className="h-3 w-3" />, label: "Expired" },
  };
  const s = statusMap[status] ?? statusMap.pending;

  const expCountdown = r.expires_at ? Math.max(0, Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000)) : null;

  return (
    <article className="glass rounded-2xl p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className={cn("h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center shadow-glow", isUpi ? "bg-gradient-primary" : "bg-gradient-coin")}>
          {isUpi ? <Smartphone className="h-5 w-5 text-primary-foreground" /> : <Gift className="h-5 w-5 text-coin-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold truncate">{isUpi ? "UPI Withdrawal" : r.brand}</h3>
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", s.color)}>
              {s.icon} {s.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ₹{r.amount_inr} · {r.coins_spent.toLocaleString()} NC · {new Date(r.created_at).toLocaleDateString()}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">via {r.delivery_method}{isUpi && r.upi_id ? ` · ${r.upi_id}` : ""}</p>
        </div>
      </div>

      {r.voucher_code && status === "completed" && (
        <div className="mt-3 rounded-2xl border border-dashed border-primary/40 bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Voucher Code</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="text-sm font-bold tracking-wider text-gradient-neon truncate">{r.voucher_code}</code>
            <button onClick={() => onCopy(r.voucher_code!)} className="rounded-full bg-accent/15 p-1.5 text-accent">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {r.voucher_pin && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PIN</span>
              <code className="text-xs font-bold">{r.voucher_pin}</code>
              <button onClick={() => onCopy(r.voucher_pin!)} className="rounded-full bg-accent/15 p-1 text-accent">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}
          {expCountdown !== null && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Expires in {expCountdown} day{expCountdown === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </article>
  );
};

export default MyRedemptions;
