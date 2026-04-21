import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Disc3, Gift, ListChecks, Sparkles, Target, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import earnHero from "@/assets/earn-hero.jpg";
import surveyImg from "@/assets/survey-card.jpg";
import spinImg from "@/assets/spin-wheel.jpg";
import scratchImg from "@/assets/scratch-card.jpg";

type Survey = {
  id: string;
  title: string;
  reward: number;
  duration: number;
  rating: number;
  category: string;
};

const MOCK_SURVEYS: Survey[] = [
  { id: "s1", title: "Tech & Gadget Habits", reward: 240, duration: 6, rating: 4.7, category: "Technology" },
  { id: "s2", title: "Food Delivery Experience", reward: 180, duration: 4, rating: 4.5, category: "Lifestyle" },
  { id: "s3", title: "Travel Plans 2090", reward: 360, duration: 9, rating: 4.8, category: "Travel" },
  { id: "s4", title: "Streaming & Entertainment", reward: 120, duration: 3, rating: 4.4, category: "Media" },
  { id: "s5", title: "Online Shopping Trends", reward: 300, duration: 7, rating: 4.6, category: "Shopping" },
  { id: "s6", title: "Health & Wellness Quick Poll", reward: 90, duration: 2, rating: 4.2, category: "Health" },
];

const Earn = () => {
  const [claimedToday, setClaimedToday] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_activity")
        .select("activity")
        .eq("activity_date", today);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r) => (map[r.activity] = true));
      setClaimedToday(map);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-28">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <img
          src={earnHero}
          alt="NovaReward earning hub holographic coins"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          width={1280}
          height={768}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative px-5 pt-12 pb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Earn Hub · 2090
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight">
            <span className="text-gradient-neon">Stack Nova Coins</span>
            <br />
            <span className="text-foreground">at lightspeed</span>
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Surveys, daily spins & scratch cards — credited instantly to your wallet.
          </p>
        </div>
      </header>

      {/* Quick action grid */}
      <section className="px-4 -mt-2">
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            to="/spin"
            img={spinImg}
            title="Spin Wheel"
            subtitle="Daily · up to 500 NC"
            icon={<Disc3 className="h-4 w-4" />}
            done={!!claimedToday.spin}
            accent="from-accent/40 to-primary/30"
          />
          <ActionTile
            to="/scratch"
            img={scratchImg}
            title="Scratch Card"
            subtitle="Daily · up to 300 NC"
            icon={<Sparkles className="h-4 w-4" />}
            done={!!claimedToday.scratch}
            accent="from-secondary/40 to-primary/30"
          />
          <ActionTile
            to="/earn"
            img={surveyImg}
            title="Surveys"
            subtitle={`${MOCK_SURVEYS.length} live now`}
            icon={<ListChecks className="h-4 w-4" />}
            accent="from-primary/40 to-accent/30"
          />
          <ActionTile
            to="/earn"
            img={earnHero}
            title="Tasks & Offers"
            subtitle="Coming via CPX"
            icon={<Target className="h-4 w-4" />}
            disabled
            accent="from-secondary/40 to-accent/30"
          />
        </div>
      </section>

      {/* Surveys list */}
      <section className="mt-8 px-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold">Live Surveys</h2>
            <p className="text-xs text-muted-foreground">High-paying · short duration</p>
          </div>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
            CPX Network
          </span>
        </div>

        <div className="space-y-3">
          {MOCK_SURVEYS.map((s, i) => (
            <article
              key={s.id}
              className="glass relative overflow-hidden rounded-2xl p-4 animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {s.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">★ {s.rating}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-bold">{s.title}</h3>
                  <p className="text-[11px] text-muted-foreground">~{s.duration} min · instant credit</p>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-gradient-coin">+{s.reward}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nova</div>
                </div>
              </div>
              <Button
                variant="hero"
                size="sm"
                className="mt-3 w-full"
                onClick={() => alert("Survey integration goes live once CPX account is approved.")}
              >
                Start Survey <ArrowRight className="h-4 w-4" />
              </Button>
            </article>
          ))}
        </div>
      </section>

      {/* Daily bonus banner */}
      <section className="mt-8 px-4">
        <Link
          to="/spin"
          className="relative block overflow-hidden rounded-3xl border border-primary/40 p-5 shadow-glow"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative flex items-center gap-4">
            <div className="rounded-2xl bg-background/30 p-3 backdrop-blur">
              <Gift className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-primary-foreground/80">Daily Reward</p>
              <h3 className="text-lg font-extrabold text-primary-foreground">Spin to win 500 NC</h3>
            </div>
            <ArrowRight className="h-5 w-5 text-primary-foreground" />
          </div>
        </Link>
      </section>

      <BottomNav />
    </div>
  );
};

const ActionTile = ({
  to,
  img,
  title,
  subtitle,
  icon,
  done,
  disabled,
  accent,
}: {
  to: string;
  img: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  done?: boolean;
  disabled?: boolean;
  accent: string;
}) => {
  const Wrapper: any = disabled ? "div" : Link;
  return (
    <Wrapper
      to={disabled ? undefined : to}
      className={cn(
        "glass group relative aspect-[4/5] overflow-hidden rounded-2xl p-3 transition-bounce",
        !disabled && "active:scale-[0.97] hover:shadow-glow",
        disabled && "opacity-60"
      )}
    >
      <img
        src={img}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover opacity-50 transition-smooth group-hover:opacity-70"
        loading="lazy"
        width={400}
        height={500}
      />
      <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", accent)} />
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/60 text-accent backdrop-blur">
            {icon}
          </span>
          {done && (
            <span className="rounded-full bg-success/90 px-2 py-0.5 text-[9px] font-bold uppercase text-success-foreground">
              Claimed
            </span>
          )}
          {disabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
              Soon
            </span>
          )}
        </div>
        <div>
          <h3 className="text-base font-extrabold leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </Wrapper>
  );
};

export default Earn;
