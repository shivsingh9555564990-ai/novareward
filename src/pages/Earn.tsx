import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Crown, Disc3, Flame, Gift, ListChecks, Rocket, Search, Sparkles, Star, Target, Timer, Zap, Brain } from "lucide-react";
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

type SponsoredOffer = {
  id: string;
  title: string;
  subtitle: string | null;
  cta_url: string;
  reward: number;
  duration_label: string | null;
  badge_label: string | null;
  badge_emoji: string | null;
  animation_style: string;
  sort_order: number;
};

type Filter = "all" | "survey" | "task" | "game";
type Sort = "newest" | "reward" | "time";

const Earn = () => {
  const [claimedToday, setClaimedToday] = useState<Record<string, boolean>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sponsored, setSponsored] = useState<SponsoredOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: act }, { data: off }, { data: sp }] = await Promise.all([
        supabase.from("daily_activity").select("activity").eq("activity_date", today),
        supabase.from("offers").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("sponsored_offers").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      ]);
      const map: Record<string, boolean> = {};
      (act ?? []).forEach((r) => (map[r.activity] = true));
      setClaimedToday(map);
      setOffers((off ?? []) as Offer[]);
      setSponsored((sp ?? []) as SponsoredOffer[]);
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
          <ActionTile to="/refer" badge={iconSurvey} title="Refer & Earn" subtitle="+50 NC each" icon={<Target className="h-4 w-4" />} accent="from-secondary/40 to-accent/30" />
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

      {/* Sponsored / Special Tasks */}
      {sponsored.length > 0 && (
        <section className="mt-6 px-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gradient-neon flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Sponsored
            </h2>
            <span className="rounded-full border border-coin/40 bg-coin/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-coin">
              Instant Reward
            </span>
          </div>
          <div className="space-y-4">
            {sponsored.map((s, i) => (
              <SponsoredTask key={s.id} offer={s} index={i} />
            ))}
          </div>
        </section>
      )}

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

// Visual style presets per animation_style. All colors are HSL design tokens.
const SPONSOR_STYLES: Record<string, {
  border: string;
  borderAnim: string;
  blobA: string;
  blobB: string;
  iconBg: string;
  iconShadow: string;
  Icon: React.ComponentType<{ className?: string }>;
  ctaBg: string;
  shimmer: string;
  badgeRing: string;
  iconAnim: string;
}> = {
  aurora: {
    border: "bg-[conic-gradient(from_0deg,hsl(var(--primary)),hsl(var(--accent)),hsl(var(--coin)),hsl(var(--secondary)),hsl(var(--primary)))]",
    borderAnim: "animate-spin-slow",
    blobA: "bg-primary/40",
    blobB: "bg-accent/30",
    iconBg: "bg-gradient-primary",
    iconShadow: "shadow-glow",
    Icon: Flame,
    ctaBg: "bg-gradient-primary/90",
    shimmer: "bg-[linear-gradient(110deg,transparent_30%,hsl(var(--primary-foreground)/0.35)_50%,transparent_70%)]",
    badgeRing: "border-primary/40 text-primary bg-primary/10",
    iconAnim: "animate-glow-pulse",
  },
  neon: {
    border: "bg-[conic-gradient(from_180deg,hsl(var(--accent)),hsl(var(--primary)),hsl(var(--accent)))]",
    borderAnim: "animate-spin-slower",
    blobA: "bg-accent/50",
    blobB: "bg-primary/40",
    iconBg: "bg-gradient-to-br from-accent to-primary",
    iconShadow: "shadow-[0_0_30px_hsl(var(--accent)/0.6)]",
    Icon: Zap,
    ctaBg: "bg-gradient-to-r from-accent to-primary",
    shimmer: "bg-[linear-gradient(110deg,transparent_30%,hsl(var(--accent-foreground)/0.4)_50%,transparent_70%)]",
    badgeRing: "border-accent/40 text-accent bg-accent/10",
    iconAnim: "animate-float-y",
  },
  sunset: {
    border: "bg-[conic-gradient(from_45deg,hsl(var(--coin)),hsl(var(--secondary)),hsl(var(--primary)),hsl(var(--coin)))]",
    borderAnim: "animate-spin-slow",
    blobA: "bg-coin/40",
    blobB: "bg-secondary/40",
    iconBg: "bg-gradient-to-br from-coin to-secondary",
    iconShadow: "shadow-[0_0_30px_hsl(var(--coin)/0.55)]",
    Icon: Sparkles,
    ctaBg: "bg-gradient-to-r from-coin to-secondary",
    shimmer: "bg-[linear-gradient(110deg,transparent_30%,hsl(var(--coin-foreground)/0.45)_50%,transparent_70%)]",
    badgeRing: "border-coin/40 text-coin bg-coin/10",
    iconAnim: "animate-tilt",
  },
  ocean: {
    border: "bg-[conic-gradient(from_90deg,hsl(var(--secondary)),hsl(var(--primary)),hsl(var(--accent)),hsl(var(--secondary)))]",
    borderAnim: "animate-spin-slower",
    blobA: "bg-secondary/40",
    blobB: "bg-primary/30",
    iconBg: "bg-gradient-to-br from-secondary to-primary",
    iconShadow: "shadow-[0_0_30px_hsl(var(--secondary)/0.55)]",
    Icon: Rocket,
    ctaBg: "bg-gradient-to-r from-secondary to-primary",
    shimmer: "bg-[linear-gradient(110deg,transparent_30%,hsl(var(--primary-foreground)/0.35)_50%,transparent_70%)]",
    badgeRing: "border-secondary/40 text-secondary-foreground bg-secondary/20",
    iconAnim: "animate-float-y",
  },
  gold: {
    border: "bg-[conic-gradient(from_0deg,hsl(var(--coin)),hsl(45_95%_60%),hsl(var(--coin)),hsl(45_95%_60%))]",
    borderAnim: "animate-spin-slow",
    blobA: "bg-coin/50",
    blobB: "bg-coin/30",
    iconBg: "bg-gradient-to-br from-coin to-[hsl(45_95%_60%)]",
    iconShadow: "shadow-[0_0_35px_hsl(var(--coin)/0.65)]",
    Icon: Crown,
    ctaBg: "bg-gradient-to-r from-coin to-[hsl(45_95%_60%)]",
    shimmer: "bg-[linear-gradient(110deg,transparent_30%,hsl(var(--coin-foreground)/0.5)_50%,transparent_70%)]",
    badgeRing: "border-coin/50 text-coin bg-coin/15",
    iconAnim: "animate-glow-pulse",
  },
};

const SponsoredTask = ({ offer, index }: { offer: SponsoredOffer; index: number }) => {
  const [opened, setOpened] = useState(false);
  const style = SPONSOR_STYLES[offer.animation_style] ?? SPONSOR_STYLES.aurora;
  const Icon = style.Icon;
  const handleOpen = () => {
    setOpened(true);
    window.open(offer.cta_url, "_blank", "noopener,noreferrer");
  };
  return (
    <button
      onClick={handleOpen}
      style={{ animationDelay: `${index * 80}ms` }}
      className="group relative block w-full overflow-hidden rounded-3xl p-[1.5px] text-left transition-bounce active:scale-[0.98] animate-slide-up"
    >
      {/* Animated gradient border */}
      <span className={cn("absolute inset-[-30%] rounded-3xl opacity-90", style.border, style.borderAnim)} />
      <div className="relative rounded-[calc(1.5rem-1.5px)] bg-background/85 backdrop-blur-xl p-4 overflow-hidden">
        {/* Glow blobs */}
        <div className={cn("pointer-events-none absolute -top-16 -right-12 h-44 w-44 rounded-full blur-3xl animate-pulse", style.blobA)} />
        <div className={cn("pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full blur-3xl animate-pulse [animation-delay:600ms]", style.blobB)} />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />

        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0">
            <div className={cn("absolute inset-0 rounded-2xl blur-md opacity-80", style.iconBg, style.iconAnim)} />
            <div className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl", style.iconBg, style.iconShadow)}>
              <Icon className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {offer.badge_label && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border", style.badgeRing)}>
                  <span aria-hidden>{offer.badge_emoji ?? "✨"}</span> {offer.badge_label}
                </span>
              )}
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success border border-success/30">Instant</span>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent border border-accent/30">Sponsored</span>
            </div>
            <h3 className="mt-1.5 text-base font-extrabold leading-tight">{offer.title}</h3>
            {offer.subtitle && (
              <p className="text-[11px] text-muted-foreground leading-snug">{offer.subtitle}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {offer.duration_label && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Timer className="h-3 w-3" /> {offer.duration_label}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="flex items-center gap-0.5 text-[10px] text-coin">
                {[0, 1, 2].map((i) => <Star key={i} className="h-2.5 w-2.5 fill-coin text-coin" />)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-extrabold text-gradient-coin whitespace-nowrap">+{offer.reward}</div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Nova</div>
          </div>
        </div>

        <div className={cn("relative mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5 shadow-glow overflow-hidden", style.ctaBg)}>
          <span className={cn("absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000", style.shimmer)} />
          <span className="relative text-xs font-extrabold uppercase tracking-wider text-primary-foreground">
            {opened ? "Reopen Offer" : "Start Task Now"}
          </span>
          <ArrowRight className="relative h-4 w-4 text-primary-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </button>
  );
};

export default Earn;
