import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Coins,
  Flame,
  TrendingUp,
  Sparkles,
  Gamepad2,
  ClipboardList,
  Gift,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Star,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { formatRupees, getGreeting } from "@/lib/nova";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";
import novaLogo from "@/assets/nova-logo.png";
import homeHero from "@/assets/home-hero.jpg";
import iconSurvey from "@/assets/icon-survey.png";
import iconGames from "@/assets/icon-games.png";
import iconBonus from "@/assets/icon-bonus.png";
import iconCoin from "@/assets/icon-coin.png";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  interests: string[] | null;
}

// Mock data — to be replaced with real partner services in later phases
const FEATURED_TASKS = [
  { id: "f1", title: "Complete Quick Survey", reward: 240, time: "5 min", color: "bg-gradient-primary" },
  { id: "f2", title: "Try New AI App", reward: 600, time: "10 min", color: "bg-gradient-success" },
  { id: "f3", title: "Watch & Earn Bonus", reward: 120, time: "2 min", color: "bg-gradient-coin" },
];

const EARNING_OPTIONS = [
  { key: "survey", label: "Surveys", icon: ClipboardList, badge: 24, color: "from-violet-500 to-fuchsia-500", route: "/earn" },
  { key: "task", label: "Tasks", icon: Sparkles, badge: 12, color: "from-cyan-400 to-violet-500", route: "/earn" },
  { key: "game", label: "Games", icon: Gamepad2, badge: 6, color: "from-pink-500 to-rose-500", route: "/earn" },
  { key: "bonus", label: "Daily Bonus", icon: Gift, badge: 1, color: "from-amber-400 to-orange-500", route: "/earn" },
] as const;

const RECOMMENDED = [
  { id: "r1", title: "Cashback App Install", reward: 480, time: "3 min", progress: 0 },
  { id: "r2", title: "Product Feedback Survey", reward: 300, time: "7 min", progress: 25 },
  { id: "r3", title: "Watch Trailer x3", reward: 180, time: "4 min", progress: 66 },
  { id: "r4", title: "Sign up for Newsletter", reward: 240, time: "2 min", progress: 0 },
  { id: "r5", title: "Refer a Friend", reward: 1200, time: "—", progress: 0 },
];


const Home = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [unread, setUnread] = useState(0);

  const greeting = useMemo(() => getGreeting(), []);
  const animatedCoins = useCountUp(profile?.coins ?? 0);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, coins, interests")
      .eq("id", user.id)
      .maybeSingle();
    if (data) setProfile(data);
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Real notifications unread count + realtime
  useEffect(() => {
    if (!user) return;
    const loadUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      setUnread(count ?? 0);
    };
    loadUnread();
    const ch = supabase
      .channel("home-notif")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        loadUnread
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Featured task rotation
  useEffect(() => {
    const t = setInterval(() => setFeaturedIdx((i) => (i + 1) % FEATURED_TASKS.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Online status
  useEffect(() => {
    const goOn = () => {
      setOnline(true);
      toast.success("Back online — syncing");
      loadProfile();
    };
    const goOff = () => {
      setOnline(false);
      toast.error("You're offline");
    };
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => {
      window.removeEventListener("online", goOn);
      window.removeEventListener("offline", goOff);
    };
  }, [loadProfile]);

  // Auto refresh every 30s
  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine) loadProfile();
    }, 30000);
    return () => clearInterval(t);
  }, [loadProfile]);

  const refreshData = async () => {
    setRefreshing(true);
    await loadProfile();
    setTimeout(() => {
      setRefreshing(false);
      toast.success("Synced ✨");
    }, 600);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-gradient-primary animate-pulse-glow" />
      </div>
    );
  }

  const featured = FEATURED_TASKS[featuredIdx];
  const firstName = (profile?.full_name || user.email?.split("@")[0] || "Explorer").split(" ")[0];
  const level = Math.max(1, Math.floor((profile?.coins ?? 0) / 500) + 1);
  const xpInLevel = ((profile?.coins ?? 0) % 500) / 5; // 0-100
  const todayEarning = Math.round((profile?.coins ?? 0) * 0.08); // mock derived
  const streak = 4; // mock until streak system added

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      {/* Holographic grid backdrop */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <div className="pointer-events-none absolute -top-32 -left-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-16 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-primary/10">
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3"
            aria-label="Open profile"
          >
            <div className="relative">
              <div className="h-11 w-11 rounded-full bg-gradient-primary p-[2px] shadow-glow">
                <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-xl">
                  {profile?.avatar_url || "👤"}
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
            </div>
            <div className="text-left">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {greeting}
              </p>
              <p className="text-sm font-bold leading-tight">
                {firstName} <span className="text-primary">✦</span>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold",
                online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {online ? "Live" : "Offline"}
            </div>
            <button
              onClick={refreshData}
              aria-label="Refresh"
              className="h-10 w-10 rounded-2xl glass flex items-center justify-center"
            >
              <RefreshCw className={cn("w-4 h-4 text-foreground", refreshing && "animate-spin")} />
            </button>
            <button
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
              className="relative h-10 w-10 rounded-2xl glass flex items-center justify-center"
            >
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center shadow-neon">
                  {unread}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-5 pt-5 space-y-6">
        {/* Coin balance card */}
        <section className="animate-slide-up">
          <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-primary shadow-glow">
            {/* Scanning line */}
            <div className="pointer-events-none absolute inset-x-0 h-px bg-gradient-neon opacity-70 animate-scan" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -right-16 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-xl" />

            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-primary-foreground/80 text-xs uppercase tracking-[0.2em]">
                  Nova Wallet
                </p>
                <img src={novaLogo} alt="NovaRewards" className="h-6 w-6 opacity-90" />
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <Coins className="w-7 h-7 text-coin animate-coin-spin drop-shadow-[0_0_8px_hsl(var(--coin))]" />
                <span className="text-5xl font-extrabold text-primary-foreground tracking-tight tabular-nums">
                  {animatedCoins.toLocaleString()}
                </span>
                <span className="text-primary-foreground/80 font-semibold">NC</span>
              </div>
              <p className="text-primary-foreground/80 text-sm">
                ≈ {formatRupees(profile?.coins ?? 0)}{" "}
                <span className="opacity-70">· 120 NC = ₹10</span>
              </p>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => navigate("/redeem")}
                  className="flex-1 h-11 rounded-2xl bg-background/15 backdrop-blur border border-white/20 text-primary-foreground font-semibold text-sm hover:bg-background/25 transition-smooth"
                >
                  Redeem
                </button>
                <button
                  onClick={() => navigate("/earn")}
                  className="flex-1 h-11 rounded-2xl bg-coin text-coin-foreground font-bold text-sm shadow-coin hover:scale-[1.02] transition-bounce"
                >
                  Earn More
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <section className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "60ms" }}>
          <StatCard
            icon={TrendingUp}
            label="Today"
            value={`${todayEarning} NC`}
            tint="text-accent"
            ring="ring-accent/40"
          />
          <StatCard
            icon={Flame}
            label="Streak"
            value={`${streak} days`}
            tint="text-coin"
            ring="ring-coin/40"
          />
          <StatCard
            icon={Star}
            label={`Lvl ${level}`}
            value={`${Math.round(xpInLevel)}% XP`}
            tint="text-primary"
            ring="ring-primary/40"
            progress={xpInLevel}
          />
        </section>

        {/* Featured task banner */}
        <section className="animate-slide-up" style={{ animationDelay: "120ms" }}>
          <div className="relative overflow-hidden rounded-3xl glass p-5">
            <div className={cn("absolute inset-0 opacity-20", featured.color)} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold mb-1">
                  ⚡ Featured · {featured.time}
                </p>
                <p className="font-bold text-base leading-tight max-w-[200px]">
                  {featured.title}
                </p>
                <p className="mt-2 text-coin font-extrabold flex items-center gap-1">
                  <Coins className="w-4 h-4" /> +{featured.reward} NC
                </p>
              </div>
              <button
                onClick={() => navigate("/earn")}
                className="h-11 w-11 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center"
                aria-label="Start featured task"
              >
                <ChevronRight className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
            {/* dots */}
            <div className="mt-4 flex gap-1.5">
              {FEATURED_TASKS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-smooth",
                    i === featuredIdx ? "w-6 bg-primary" : "w-2 bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Earning options */}
        <section className="animate-slide-up" style={{ animationDelay: "180ms" }}>
          <SectionHeader title="Earn Nova Coins" subtitle="Pick your mission" />
          <div className="grid grid-cols-2 gap-3">
            {EARNING_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => navigate(opt.route)}
                className="group relative overflow-hidden rounded-2xl glass p-4 text-left transition-bounce hover:scale-[1.02]"
              >
                <div
                  className={cn(
                    "h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-soft",
                    opt.color
                  )}
                >
                  <opt.icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.badge} available
                </p>
                <span className="absolute top-3 right-3 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-glow">
                  {opt.badge}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Recommended tasks carousel */}
        <section className="animate-slide-up" style={{ animationDelay: "240ms" }}>
          <SectionHeader
            title="Recommended for you"
            subtitle="AI-picked · high reward"
            action={
              <button
                onClick={() => navigate("/earn")}
                className="text-xs font-semibold text-primary"
              >
                See all
              </button>
            }
          />
          <div className="-mx-5 px-5 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
            {RECOMMENDED.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate("/earn")}
                className="snap-start shrink-0 w-56 text-left rounded-2xl glass p-4 transition-bounce hover:scale-[1.02]"
              >
                <div className="h-24 rounded-xl bg-gradient-hero grid-bg mb-3 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary animate-neon-pulse" />
                </div>
                <p className="font-bold text-sm leading-tight">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{t.time}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-coin font-extrabold text-sm flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> +{t.reward}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {t.progress}%
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-neon"
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>

      </main>

      <BottomNav />
    </div>
  );
};

const SectionHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-end justify-between mb-3">
    <div>
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  tint,
  ring,
  progress,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tint: string;
  ring: string;
  progress?: number;
}) => (
  <div className={cn("relative rounded-2xl glass p-3 ring-1", ring)}>
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={cn("w-3.5 h-3.5", tint)} />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
    </div>
    <p className="font-bold text-sm">{value}</p>
    {progress !== undefined && (
      <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-neon" style={{ width: `${progress}%` }} />
      </div>
    )}
  </div>
);

export default Home;
