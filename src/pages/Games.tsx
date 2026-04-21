import { Link } from "react-router-dom";
import { ArrowLeft, Brain, Disc3, Sparkles, Star, Zap, Gift, Dices, Puzzle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import iconSpin from "@/assets/icon-spin.png";
import iconScratch from "@/assets/icon-scratch.png";

type Game = {
  to: string;
  title: string;
  desc: string;
  reward: string;
  difficulty: number;
  icon: React.ReactNode;
  badge?: string;
  free: boolean;
  soon?: boolean;
  accent: string;
};

const GAMES: Game[] = [
  { to: "/quiz", title: "Daily Quiz", desc: "10 questions · mixed", reward: "10–100 NC", difficulty: 2, icon: <Brain className="h-5 w-5" />, free: true, accent: "from-primary/40 to-accent/30" },
  { to: "/spin", title: "Spin Wheel", desc: "Daily spin", reward: "1–5 NC", difficulty: 1, icon: <Disc3 className="h-5 w-5" />, badge: iconSpin, free: true, accent: "from-accent/40 to-secondary/30" },
  { to: "/scratch", title: "Scratch Card", desc: "Reveal & win", reward: "1–3 NC", difficulty: 1, icon: <Sparkles className="h-5 w-5" />, badge: iconScratch, free: true, accent: "from-secondary/40 to-primary/30" },
  { to: "#", title: "Tap the Coin", desc: "60s tap rush", reward: "5–50 NC", difficulty: 1, icon: <Zap className="h-5 w-5" />, free: true, soon: true, accent: "from-coin/30 to-accent/30" },
  { to: "#", title: "Memory Match", desc: "Match pairs", reward: "10–80 NC", difficulty: 2, icon: <Puzzle className="h-5 w-5" />, free: true, soon: true, accent: "from-accent/30 to-primary/30" },
  { to: "#", title: "Lucky Dice", desc: "Roll & multiply", reward: "5–60 NC", difficulty: 1, icon: <Dices className="h-5 w-5" />, free: true, soon: true, accent: "from-secondary/30 to-coin/30" },
];

const Games = () => {
  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <Link to="/earn" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Game Hub</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Play & Earn</span></h1>
        </div>
      </header>

      <main className="relative z-10 px-4 mt-5 space-y-4">
        {/* Daily bonus banner */}
        <div className="glass relative overflow-hidden rounded-3xl p-4 flex items-center gap-3">
          <div className="absolute inset-0 bg-gradient-primary opacity-20" />
          <div className="relative h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Gift className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="relative flex-1">
            <p className="text-xs uppercase tracking-widest text-accent">Daily Bonus</p>
            <p className="text-sm font-bold">Spin + Scratch = up to 8 NC</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {GAMES.map((g, i) => {
            const Wrapper: any = g.soon ? "div" : Link;
            return (
              <Wrapper key={g.title} to={g.soon ? undefined : g.to} className={cn("glass group relative aspect-[4/5] overflow-hidden rounded-2xl p-3 transition-bounce animate-slide-up", !g.soon && "active:scale-[0.97] hover:shadow-glow", g.soon && "opacity-60")} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", g.accent)} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-background/60 text-accent backdrop-blur">{g.icon}</span>
                    {g.soon ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">Soon</span>
                    ) : g.free ? (
                      <span className="rounded-full bg-success/90 px-2 py-0.5 text-[9px] font-bold uppercase text-success-foreground">Free</span>
                    ) : null}
                  </div>
                  {g.badge && <img src={g.badge} alt="" aria-hidden="true" className="absolute right-1 top-12 h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" loading="lazy" />}
                  <div>
                    <h3 className="text-base font-extrabold leading-tight">{g.title}</h3>
                    <p className="text-[11px] text-muted-foreground">{g.desc}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gradient-coin">{g.reward}</span>
                      <span className="flex gap-0.5">
                        {Array.from({ length: g.difficulty }).map((_, j) => <Star key={j} className="h-2.5 w-2.5 fill-coin text-coin" />)}
                      </span>
                    </div>
                  </div>
                </div>
              </Wrapper>
            );
          })}
        </div>

        <p className="text-center text-[10px] text-muted-foreground pt-2">
          More games unlock weekly · Tap to play
        </p>
      </main>
      <BottomNav />
    </div>
  );
};

export default Games;
