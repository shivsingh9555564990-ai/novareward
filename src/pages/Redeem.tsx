import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Sparkles, Coins, Check, IndianRupee, Smartphone, History, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GIFT_CARDS, GIFT_CARD_CATEGORIES, giftCardsByCategory, type GiftCardBrand } from "@/lib/giftCards";
import redeemHero from "@/assets/redeem-hero.jpg";

const NC_PER_INR = 12;
type Mode = "browse" | "giftcard" | "upi" | "confirm" | "done";

const UPI_QUICK = [100, 250, 500, 1000, 2000];
const GIFT_QUICK = [100, 250, 500, 1000, 2000, 5000];

const Redeem = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("browse");
  const [tab, setTab] = useState<"giftcard" | "upi">("giftcard");
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GiftCardBrand | null>(null);
  const [amountInr, setAmountInr] = useState<number>(100);
  const [upiId, setUpiId] = useState("");
  const [coins, setCoins] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("coins").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCoins(data?.coins ?? 0));
  }, [user, mode]);

  const filtered = useMemo(() => {
    const base = giftCardsByCategory(category);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((g) => g.name.toLowerCase().includes(q));
  }, [category, search]);

  const required = amountInr * NC_PER_INR;
  const enough = coins >= required;

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_redemption", {
      p_type: tab === "upi" ? "upi" : "giftcard",
      p_brand: selected?.name ?? null,
      p_amount_inr: amountInr,
      p_upi_id: tab === "upi" ? upiId : null,
    });
    setSubmitting(false);
    if (error) { toast.error("Could not submit. Try again."); return; }
    const res = data as { success: boolean; error?: string; redemption_id?: string };
    if (!res?.success) {
      const map: Record<string, string> = {
        insufficient_coins: "Not enough Nova Coins",
        invalid_upi: "Invalid UPI ID",
        invalid_amount: "Amount out of range",
        invalid_brand: "Pick a gift card brand",
      };
      toast.error(map[res?.error || ""] || "Failed");
      return;
    }
    setDoneRef(res.redemption_id ?? null);
    setMode("done");
    toast.success("Redemption queued!");
  };

  // ─────────────── Renders ───────────────
  if (mode === "done") {
    return (
      <div className="relative min-h-screen pb-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-success/30 blur-3xl animate-pulse-glow" />
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="h-24 w-24 rounded-full bg-gradient-success p-[3px] shadow-glow animate-pulse-glow">
            <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
              <Check className="h-10 w-10 text-success" />
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-gradient-neon">Request Queued</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            ₹{amountInr} {tab === "upi" ? "UPI withdrawal" : `${selected?.name} gift card`} request submitted.
            Coins debited. You'll get notified within 24 hours.
          </p>
          {doneRef && (
            <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Ref · {doneRef.slice(0, 8)}
            </p>
          )}
          <div className="mt-8 w-full max-w-sm space-y-2">
            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/transactions")}>
              <History className="w-4 h-4" /> View Transactions
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={() => { setMode("browse"); setSelected(null); }}>
              Redeem More
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="relative min-h-screen pb-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <header className="relative flex items-center gap-3 px-5 pt-8">
          <button onClick={() => setMode(tab === "upi" ? "upi" : "giftcard")} className="rounded-full bg-muted/60 p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-extrabold">Confirm</h1>
        </header>
        <main className="relative z-10 mt-6 px-5">
          <div className="glass rounded-3xl p-6 text-center">
            {tab === "giftcard" && selected ? (
              <>
                <div className={cn("mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl shadow-glow", selected.color)}>
                  {selected.emoji}
                </div>
                <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">{selected.category}</p>
                <p className="text-lg font-extrabold">{selected.name} Gift Card</p>
              </>
            ) : (
              <>
                <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Smartphone className="h-9 w-9 text-primary-foreground" />
                </div>
                <p className="mt-3 text-lg font-extrabold">UPI Withdrawal</p>
                <p className="text-xs text-muted-foreground">{upiId}</p>
              </>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You receive</p>
                <p className="mt-1 text-2xl font-extrabold text-success">₹{amountInr}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Coins debited</p>
                <p className="mt-1 text-2xl font-extrabold text-coin">{required}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Balance after: {(coins - required).toLocaleString()} NC · Processing 24h
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Button variant="hero" size="xl" className="w-full" onClick={submit} disabled={submitting || !enough}>
              {submitting ? "Submitting…" : enough ? "Confirm Redemption" : "Insufficient Coins"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setMode(tab === "upi" ? "upi" : "giftcard")}>
              Back
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (mode === "upi") {
    return (
      <div className="relative min-h-screen pb-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <header className="relative flex items-center gap-3 px-5 pt-8">
          <button onClick={() => setMode("browse")} className="rounded-full bg-muted/60 p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-extrabold">UPI Withdrawal</h1>
        </header>
        <main className="relative z-10 mt-6 px-5 space-y-5">
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">UPI ID</p>
            <Input
              placeholder="yourname@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value.trim())}
              className="mt-2"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">e.g., 9876543210@paytm, name@okaxis</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Amount (₹)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {UPI_QUICK.map((a) => (
                <button key={a} onClick={() => setAmountInr(a)}
                  className={cn("rounded-full px-4 py-2 text-sm font-bold transition-bounce border",
                    amountInr === a ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "border-primary/30 text-foreground bg-muted/40")}>
                  ₹{a}
                </button>
              ))}
            </div>
            <Input type="number" min={100} max={10000} value={amountInr}
              onChange={(e) => setAmountInr(Number(e.target.value) || 0)} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">
              Cost: <span className="font-bold text-coin">{amountInr * NC_PER_INR} NC</span> · Min ₹100 · Max ₹10,000
            </p>
          </div>
          <Button variant="hero" size="xl" className="w-full"
            onClick={() => { setTab("upi"); setMode("confirm"); }}
            disabled={amountInr < 100 || amountInr > 10000 || upiId.length < 4}>
            Continue
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (mode === "giftcard" && selected) {
    return (
      <div className="relative min-h-screen pb-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <header className="relative flex items-center gap-3 px-5 pt-8">
          <button onClick={() => { setSelected(null); setMode("browse"); }} className="rounded-full bg-muted/60 p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-extrabold">{selected.name}</h1>
        </header>
        <main className="relative z-10 mt-6 px-5 space-y-5">
          <div className={cn("relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br shadow-glow", selected.color)}>
            <div className="absolute inset-0 grid-bg opacity-20" />
            <div className="relative flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl">
                {selected.emoji}
              </div>
              <div>
                <p className="text-white/80 text-xs uppercase tracking-widest">{selected.category}</p>
                <p className="text-2xl font-extrabold text-white">{selected.name}</p>
                <p className="text-xs text-white/80">Digital code · Instant after approval</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Choose denomination</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {GIFT_QUICK.filter(a => a >= selected.minInr && a <= selected.maxInr).map((a) => (
                <button key={a} onClick={() => setAmountInr(a)}
                  className={cn("rounded-2xl py-3 font-bold transition-bounce border",
                    amountInr === a ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "border-primary/30 bg-muted/40")}>
                  <div className="text-lg">₹{a}</div>
                  <div className="text-[10px] opacity-70">{a * NC_PER_INR} NC</div>
                </button>
              ))}
            </div>
          </div>

          <Button variant="hero" size="xl" className="w-full"
            onClick={() => { setTab("giftcard"); setMode("confirm"); }}>
            Continue → ₹{amountInr}
          </Button>
        </main>
        <BottomNav />
      </div>
    );
  }

  // Browse
  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <img src={redeemHero} alt="Holographic gift card marketplace"
          className="absolute inset-0 h-full w-full object-cover opacity-50" width={1280} height={768} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <div className="relative px-5 pt-10 pb-7">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Redeem Hub · 2090
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">
            <span className="text-gradient-neon">Cash out</span> instantly
          </h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5">
            <Coins className="w-4 h-4 text-coin" />
            <span className="text-sm font-bold tabular-nums">{coins.toLocaleString()} NC</span>
            <span className="text-[10px] text-muted-foreground">≈ ₹{(coins / NC_PER_INR).toFixed(0)}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="relative z-10 -mt-2 px-5">
        <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
          {[
            { k: "giftcard" as const, label: `Gift Cards · ${GIFT_CARDS.length}+` },
            { k: "upi" as const, label: "UPI Cash" },
          ].map((t) => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k === "upi") setMode("upi"); }}
              className={cn("rounded-xl py-2.5 text-xs font-bold transition-smooth",
                tab === t.k ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 mt-5 space-y-4">
        {/* Search */}
        <div className="px-5">
          <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 150+ brands…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
        </div>

        {/* Categories */}
        <div className="px-5 -mr-5 flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {GIFT_CARD_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-smooth border",
                category === c ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "border-primary/20 bg-muted/40 text-muted-foreground")}>
              {c}
            </button>
          ))}
        </div>

        {/* Popular row */}
        {category === "All" && !search && (
          <div className="px-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 text-coin" /> Popular
            </h2>
            <div className="-mx-5 px-5 flex gap-3 overflow-x-auto scrollbar-none pb-1">
              {GIFT_CARDS.filter(g => g.popular).map(g => (
                <PopularCard key={g.id} card={g} onClick={() => { setSelected(g); setAmountInr(Math.max(g.minInr, 100)); setMode("giftcard"); setTab("giftcard"); }} />
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="px-5">
          <p className="text-xs text-muted-foreground mb-2">{filtered.length} brands</p>
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((g) => (
              <button key={g.id} onClick={() => { setSelected(g); setAmountInr(Math.max(g.minInr, 100)); setMode("giftcard"); setTab("giftcard"); }}
                className="glass aspect-square rounded-2xl p-2 transition-bounce active:scale-95 hover:shadow-glow flex flex-col">
                <div className={cn("flex-1 rounded-xl bg-gradient-to-br flex items-center justify-center text-3xl", g.color)}>
                  {g.emoji}
                </div>
                <p className="mt-1.5 truncate text-[11px] font-bold leading-tight text-center">{g.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* History link */}
        <div className="px-5 pt-2">
          <Link to="/transactions" className="glass flex items-center justify-between rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Transaction History</p>
                <p className="text-[11px] text-muted-foreground">Past redemptions & status</p>
              </div>
            </div>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

const PopularCard = ({ card, onClick }: { card: GiftCardBrand; onClick: () => void }) => (
  <button onClick={onClick} className="shrink-0 w-32 glass rounded-2xl p-3 transition-bounce active:scale-95">
    <div className={cn("aspect-video rounded-xl bg-gradient-to-br flex items-center justify-center text-3xl shadow-glow", card.color)}>
      {card.emoji}
    </div>
    <p className="mt-2 truncate text-xs font-bold">{card.name}</p>
    <p className="text-[10px] text-coin font-bold">from ₹{card.minInr}</p>
  </button>
);

export default Redeem;
