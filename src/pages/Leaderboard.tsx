import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Medal, Sparkles, Trophy, Coins, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import SmartAvatar from "@/components/SmartAvatar";
import { cn } from "@/lib/utils";
import iconLeaderboard from "@/assets/icon-leaderboard.png";

interface Row {
  rank: number;
  user_id: string;
  name: string;
  avatar_url: string | null;
  coins: number;
}

const Leaderboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ name: string; coins: number; rank: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: 100 });
      setLoading(false);
      if (error || !data) return;
      const typed = (data as any[]).map((r: any) => ({
        rank: Number(r.rank),
        user_id: r.user_id,
        name: r.name,
        avatar_url: r.avatar_url,
        coins: r.coins,
      }));
      setRows(typed);
      if (user) {
        const myRow = typed.find((r) => r.user_id === user.id);
        if (myRow) {
          setMe({ name: myRow.name, coins: myRow.coins, rank: myRow.rank });
        } else {
          const { data: prof } = await supabase
            .from("profiles").select("full_name, coins").eq("id", user.id).maybeSingle();
          if (prof) {
            setMe({ name: prof.full_name || "You", coins: prof.coins, rank: typed.length + 1 });
          }
        }
      }
    })();
  }, [user]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  const avatars = ["🚀", "⭐", "🌟", "✨", "🛸", "💫", "🪐", "🌠", "🌌", "☄️"];

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative px-5 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <img src={iconLeaderboard} alt="Leaderboard" className="h-10 w-10" width={40} height={40} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Leaderboard
            </p>
            <h1 className="text-2xl font-extrabold leading-tight text-gradient-neon">Top Earners</h1>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Real-time rankings by Nova Coins</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full bg-gradient-primary animate-pulse-glow" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 px-5">
          <p className="text-muted-foreground">No earners yet — be the first!</p>
        </div>
      ) : (
        <main className="relative z-10 mt-2 px-5 space-y-5">
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <section className="grid grid-cols-3 gap-2 items-end">
              {[top3[1], top3[0], top3[2]].map((u) => {
                if (!u) return null;
                const isFirst = u.rank === 1;
                const Icon = u.rank === 1 ? Crown : u.rank === 2 ? Medal : Trophy;
                const tint = u.rank === 1 ? "text-coin" : u.rank === 2 ? "text-accent" : "text-secondary";
                const size = isFirst ? "h-44" : "h-36";
                const fallbackEmoji = avatars[(u.rank - 1) % avatars.length];
                return (
                  <div key={u.user_id} className={cn("relative", isFirst && "-mt-4")}>
                    <div className={cn("glass relative flex flex-col items-center justify-end rounded-3xl p-3", size,
                      isFirst && "shadow-glow ring-2 ring-coin/40")}>
                      {isFirst && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-coin p-1.5 shadow-coin">
                          <Crown className="h-4 w-4 text-coin-foreground" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 text-[10px] font-extrabold opacity-60">#{u.rank}</div>
                      <div className="h-12 w-12 rounded-full bg-gradient-primary p-[2px] shadow-glow">
                        <SmartAvatar
                          src={u.avatar_url}
                          name={u.name}
                          fallback={fallbackEmoji}
                          className="h-full w-full text-xl"
                        />
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
          )}

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
          {rest.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Top 100</h2>
              <div className="glass rounded-2xl p-2 space-y-1">
                {rest.map((u) => {
                  const fallbackEmoji = avatars[(u.rank - 1) % avatars.length];
                  return (
                    <button
                      type="button"
                      key={u.user_id}
                      onClick={() => navigate(`/u/${u.user_id}`)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 active:scale-[0.99] transition-bounce"
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                        #{u.rank}
                      </div>
                      <div className="h-9 w-9 rounded-full bg-gradient-primary p-[2px]">
                        <SmartAvatar
                          src={u.avatar_url}
                          name={u.name}
                          fallback={fallbackEmoji}
                          className="h-full w-full text-base"
                        />
                      </div>
                      <p className="flex-1 text-sm font-semibold truncate">{u.name}</p>
                      <p className="text-coin font-extrabold text-sm flex items-center gap-1 tabular-nums">
                        <Coins className="h-3.5 w-3.5" /> {u.coins.toLocaleString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      )}

      <BottomNav />
    </div>
  );
};

export default Leaderboard;
