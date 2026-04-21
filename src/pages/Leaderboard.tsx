import { useEffect, useState } from "react";
import { Crown, Medal, Sparkles, Trophy, Coins, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import leaderboardHero from "@/assets/leaderboard-hero.jpg";

interface Row { rank: number; name: string; coins: number; avatar: string; isYou?: boolean }

// Mock board until friends/global ranking system is built (Phase 4)
const MOCK_TOP: Row[] = [
  { rank: 1, name: "Aarav S.", coins: 18420, avatar: "🚀" },
  { rank: 2, name: "Priya M.", coins: 15280, avatar: "⭐" },
  { rank: 3, name: "Rohit K.", coins: 12940, avatar: "🌟" },
  { rank: 4, name: "Neha P.", coins: 9820, avatar: "✨" },
  { rank: 5, name: "Vikram J.", coins: 8410, avatar: "🛸" },
  { rank: 6, name: "Anjali R.", coins: 7290, avatar: "💫" },
  { rank: 7, name: "Karan D.", coins: 6580, avatar: "🪐" },
  { rank: 8, name: "Sneha V.", coins: 5920, avatar: "🌠" },
  { rank: 9, name: "Arjun T.", coins: 5340, avatar: "🌌" },
  { rank: 10, name: "Pooja N.", coins: 4810, avatar: "☄️" },
];

const Leaderboard = () => {
  const { user } = useAuth();
  const [me, setMe] = useState<{ name: string; coins: number; rank: number } | null>(null);
  const [tab, setTab] = useState<"week" | "all">("week");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, coins").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          // Estimated rank based on mock cohort
          const rank = MOCK_TOP.findIndex((r) => data.coins > r.coins);
          setMe({
            name: data.full_name || "You",
            coins: data.coins,
            rank: rank === -1 ? MOCK_TOP.length + 1 : rank + 1,
          });
        }
      });
  }, [user]);

  const top3 = MOCK_TOP.slice(0, 3);
  const rest = MOCK_TOP.slice(3);

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative overflow-hidden">
        <img src={leaderboardHero} alt="Futuristic neon trophy podium"
          className="absolute inset-0 h-full w-full object-cover opacity-50" width={1280} height={768} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        <div className="relative px-5 pt-10 pb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Leaderboard · 2090
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">
            <span className="text-gradient-neon">Top Earners</span>
          </h1>
          <p className="text-xs text-muted-foreground">Climb the ranks · Win bonus coins</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="relative z-10 -mt-2 px-5">
        <div className="glass grid grid-cols-2 gap-1 rounded-2xl p-1">
          {[
            { k: "week", label: "This Week" },
            { k: "all", label: "All Time" },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={cn("rounded-xl py-2.5 text-xs font-bold transition-smooth",
                tab === t.k ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 mt-5 px-5 space-y-5">
        {/* Top 3 podium */}
        <section className="grid grid-cols-3 gap-2 items-end">
          {[top3[1], top3[0], top3[2]].map((u, i) => {
            if (!u) return null;
            const isFirst = u.rank === 1;
            const Icon = u.rank === 1 ? Crown : u.rank === 2 ? Medal : Trophy;
            const tint = u.rank === 1 ? "text-coin" : u.rank === 2 ? "text-accent" : "text-secondary";
            const size = isFirst ? "h-44" : "h-36";
            return (
              <div key={u.rank} className={cn("relative", isFirst && "-mt-4")}>
                <div className={cn("glass relative flex flex-col items-center justify-end rounded-3xl p-3", size,
                  isFirst && "shadow-glow ring-2 ring-coin/40")}>
                  {isFirst && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-coin p-1.5 shadow-coin">
                      <Crown className="h-4 w-4 text-coin-foreground" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 text-[10px] font-extrabold opacity-60">#{u.rank}</div>
                  <div className={cn("h-12 w-12 rounded-full bg-gradient-primary p-[2px] shadow-glow")}>
                    <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-xl">
                      {u.avatar}
                    </div>
                  </div>
                  <p className="mt-2 truncate w-full text-center text-xs font-bold">{u.name}</p>
                  <p className="text-coin text-[11px] font-extrabold flex items-center gap-1">
                    <Coins className="h-3 w-3" /> {u.coins.toLocaleString()}
                  </p>
                  <Icon className={cn("absolute bottom-2 left-2 h-3.5 w-3.5", tint)} />
                </div>
              </div>
            );
          })}
        </section>

        {/* Your rank */}
        {me && (
          <section className="relative overflow-hidden rounded-2xl bg-gradient-primary p-4 shadow-glow">
            <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
            <div className="relative flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-background/20 backdrop-blur flex items-center justify-center text-primary-foreground font-extrabold">
                #{me.rank}
              </div>
              <div className="flex-1">
                <p className="text-xs text-primary-foreground/80 uppercase tracking-widest">Your Rank</p>
                <p className="font-bold text-primary-foreground">{me.name}</p>
              </div>
              <div className="text-right">
                <p className="text-coin font-extrabold flex items-center gap-1 justify-end">
                  <Coins className="h-3.5 w-3.5" /> {me.coins.toLocaleString()}
                </p>
                <p className="text-[10px] text-primary-foreground/80 flex items-center gap-1 justify-end">
                  <TrendingUp className="h-3 w-3" /> Climbing
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Rest list */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Top 100</h2>
          <div className="glass rounded-2xl p-2 space-y-1">
            {rest.map((u) => (
              <div key={u.rank} className="flex items-center gap-3 p-2.5">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                  #{u.rank}
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-primary p-[2px]">
                  <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-base">
                    {u.avatar}
                  </div>
                </div>
                <p className="flex-1 text-sm font-semibold truncate">{u.name}</p>
                <p className="text-coin font-extrabold text-sm flex items-center gap-1 tabular-nums">
                  <Coins className="h-3.5 w-3.5" /> {u.coins.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Leaderboard;
