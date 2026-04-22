import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Disc3, Flame, Gift, ListChecks, Search, Sparkles, Star, Target, Timer, Zap, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import earnHero from "@/assets/earn-hero.jpg";
import iconSpin from "@/assets/icon-spin.png";
import iconScratch from "@/assets/icon-scratch.png";
import iconSurvey from "@/assets/icon-survey.png";
import iconGames from "@/assets/icon-games.png";

type Offer = {
  id: string;
  kind: "survey" | "task" | "game";
  provider: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  reward_min: number;
  reward_max: number;
  duration_min: number | null;
  difficulty: number | null;
  completion_rate: number | null;
  is_free: boolean;
  created_at: string;
};

type Filter = "all" | "survey" | "task" | "game";
type Sort = "newest" | "reward" | "time";

const Earn = () => {
  const [claimedToday, setClaimedToday] = useState<Record<string, boolean>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: act }, { data: off }] = await Promise.all([
        supabase.from("daily_activity").select("activity").eq("activity_date", today),
        supabase.from("offers").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      ]);
      const map: Record<string, boolean> = {};
      (act ?? []).forEach((r) => (map[r.activity] = true));
      setClaimedToday(map);
      setOffers((off ?? []) as Offer[]);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    let list = offers;
    if (filter !== "all") list = list.filter((o) => o.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          (o.category ?? "").toLowerCase().includes(q) ||
          (o.subtitle ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "reward") sorted.sort((a, b) => b.reward_max - a.reward_max);
    else if (sort === "time") sorted.sort((a, b) => (a.duration_min ?? 99) - (b.duration_min ?? 99));
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [offers, filter, sort, search]);

  return (
    <div className="min-h-screen pb-28">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <img src={earnHero} alt="NovaRewards earning hub" className="absolute inset-0 h-full w-full object-cover opacity-60" width={1280} height={768} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative px-5 pt-12 pb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Earn Hub
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight">
            <span className="text-gradient-neon">Stack Nova Coins</span>
            <br />
            <span className="text-foreground">at lightspeed</span>
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Surveys, tasks, daily games & quiz — credited instantly to your wallet.
          </p>
        </div>
      </header>

      {/* Quick action grid */}
      <section className="px-4 -mt-2">
        <div className="grid grid-cols-2 gap-3">
          <ActionTile to="/spin" badge={iconSpin} title="Spin Wheel" subtitle="Daily · 1–5 NC" icon={<Disc3 className="h-4 w-4" />} done={!!claimedToday.spin} accent="from-accent/40 to-primary/30" />
          <ActionTile to="/scratch" badge={iconScratch} title="Scratch Card" subtitle="Daily · 1–3 NC" icon={<Sparkles className="h-4 w-4" />} done={!!claimedToday.scratch} accent="from-secondary/40 to-primary/30" />
          <ActionTile to="/games" badge={iconGames} title="Games & Quiz" subtitle="Up to 100 NC" icon={<Brain className="h-4 w-4" />} accent="from-primary/40 to-accent/30" />
          <ActionTile to="#" badge={iconSurvey} title="Refer Friends" subtitle="200 NC each" icon={<Target className="h-4 w-4" />} disabled accent="from-secondary/40 to-accent/30" />
        </div>
      </section>

      {/* Search + filters */}
      <section className="mt-6 px-4 space-y-3">
        <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search offers, surveys, tasks…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {(["all", "survey", "task", "game"] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-smooth border shrink-0", filter === f ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "border-primary/20 bg-muted/30 text-muted-foreground")}>{f}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-primary/20 bg-muted/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground outline-none">
            <option value="newest">Newest</option>
            <option value="reward">Reward</option>
            <option value="time">Time</option>
          </select>
        </div>
      </section>

      {/* Sponsored / Special Task */}
      <section className="mt-6 px-4">
        <SponsoredTask />
      </section>

      {/* Offers list */}
      <section className="mt-5 px-4">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">{visible.length} live</h2>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
            Real-time
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="glass h-28 animate-pulse rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No offers match your filters.
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((o, i) => <OfferCard key={o.id} offer={o} index={i} />)}
          </div>
        )}
      </section>

      {/* Daily bonus banner */}
      <section className="mt-8 px-4">
        <Link to="/spin" className="relative block overflow-hidden rounded-3xl border border-primary/40 p-5 shadow-glow" style={{ background: "var(--gradient-primary)" }}>
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative flex items-center gap-4">
            <div className="rounded-2xl bg-background/30 p-3 backdrop-blur">
              <Gift className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-primary-foreground/80">Daily Reward</p>
              <h3 className="text-lg font-extrabold text-primary-foreground">Spin to win up to 5 NC</h3>
            </div>
            <ArrowRight className="h-5 w-5 text-primary-foreground" />
          </div>
        </Link>
      </section>

      <BottomNav />
    </div>
  );
};

const OfferCard = ({ offer, index }: { offer: Offer; index: number }) => {
  const to = offer.kind === "survey" ? `/survey/${offer.id}`
    : offer.kind === "task" ? `/task/${offer.id}`
    : offer.kind === "game" ? "/games" : "#";
  const reward = offer.reward_min === offer.reward_max ? `+${offer.reward_max}` : `+${offer.reward_min}–${offer.reward_max}`;
  const KindIcon = offer.kind === "survey" ? ListChecks : offer.kind === "task" ? Zap : Brain;
  return (
    <Link to={to} className="glass relative block overflow-hidden rounded-2xl p-4 animate-slide-up active:scale-[0.98] transition-bounce" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
          <KindIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{offer.category ?? offer.kind}</span>
            {offer.difficulty && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                {Array.from({ length: offer.difficulty }).map((_, i) => <Star key={i} className="h-2.5 w-2.5 fill-coin text-coin" />)}
              </span>
            )}
            {offer.kind === "game" && <span className="rounded-full bg-success/20 px-2 py-0.5 text-[9px] font-bold uppercase text-success">Free</span>}
          </div>
          <h3 className="mt-1 truncate text-sm font-bold">{offer.title}</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
            {offer.duration_min && <><Timer className="h-3 w-3" /> ~{offer.duration_min}m</>}
            {offer.completion_rate && <span>· {offer.completion_rate}% complete</span>}
          </p>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold text-gradient-coin whitespace-nowrap">{reward}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nova</div>
        </div>
      </div>
    </Link>
  );
};

const ActionTile = ({ to, badge, title, subtitle, icon, done, disabled, accent }: {
  to: string; badge?: string; title: string; subtitle: string; icon: React.ReactNode; done?: boolean; disabled?: boolean; accent: string;
}) => {
  const Wrapper: any = disabled ? "div" : Link;
  return (
    <Wrapper to={disabled ? undefined : to} className={cn("glass group relative aspect-[4/5] overflow-hidden rounded-2xl p-3 transition-bounce", !disabled && "active:scale-[0.97] hover:shadow-glow", disabled && "opacity-60")}>
      <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", accent)} />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/60 text-accent backdrop-blur">{icon}</span>
          {done && <span className="rounded-full bg-success/90 px-2 py-0.5 text-[9px] font-bold uppercase text-success-foreground">Claimed</span>}
          {disabled && <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">Soon</span>}
        </div>
        {badge && <img src={badge} alt="" aria-hidden="true" className="absolute right-2 top-10 h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" loading="lazy" width={56} height={56} />}
        <div>
          <h3 className="text-base font-extrabold leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </Wrapper>
  );
};

export default Earn;
