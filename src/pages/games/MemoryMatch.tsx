import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFp } from "@/lib/deviceFp";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

const EMOJIS = ["🚀", "💎", "🔥", "⭐", "🎯", "🎮"];

type Card = { id: number; emoji: string; matched: boolean; flipped: boolean };

const buildDeck = (): Card[] => {
  const pairs = [...EMOJIS, ...EMOJIS];
  return pairs
    .map((e, i) => ({ id: i, emoji: e, matched: false, flipped: false }))
    .sort(() => Math.random() - 0.5);
};

const MemoryMatch = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<"idle" | "playing" | "saving" | "done">("idle");
  const [deck, setDeck] = useState<Card[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reward, setReward] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    supabase
      .from("game_plays")
      .select("id", { count: "exact", head: true })
      .eq("game", "memory_match")
      .eq("play_date", today)
      .then(({ count }) => setRemaining(5 - (count ?? 0)));
  }, [user, phase]);

  const matchedCount = useMemo(() => deck.filter((c) => c.matched).length, [deck]);
  const allMatched = deck.length > 0 && matchedCount === deck.length;

  useEffect(() => {
    if (allMatched && phase === "playing") {
      finish();
    }
  }, [allMatched, phase]);

  const start = () => {
    if (remaining !== null && remaining <= 0) {
      toast.error("Aaj ki 5 plays khatam. Kal aana!");
      return;
    }
    setDeck(buildDeck()); setPicked([]); setMoves(0); setPhase("playing");
  };

  const flip = (id: number) => {
    if (phase !== "playing") return;
    if (picked.length >= 2) return;
    setDeck((d) => d.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    const next = [...picked, id];
    setPicked(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((i) => deck.find((c) => c.id === i) || deck[0]);
      // peek again from latest deck
      setTimeout(() => {
        setDeck((d) => {
          const ca = d.find((c) => c.id === next[0])!;
          const cb = d.find((c) => c.id === next[1])!;
          if (ca.emoji === cb.emoji) {
            return d.map((c) => (c.id === ca.id || c.id === cb.id ? { ...c, matched: true } : c));
          }
          return d.map((c) => (c.id === ca.id || c.id === cb.id ? { ...c, flipped: false } : c));
        });
        setPicked([]);
      }, 700);
    }
  };

  const finish = async () => {
    setPhase("saving");
    const fp = getDeviceFp();
    const { data, error } = await supabase.rpc("play_game", {
      p_game: "memory_match", p_score: moves, p_device_fp: fp,
    });
    if (error) { toast.error(error.message); setPhase("done"); return; }
    const res = data as any;
    if (!res?.success) {
      toast.error(res?.error === "daily_limit_reached" ? "Daily limit reached" : (res?.error ?? "Error"));
      setPhase("done"); return;
    }
    setReward(res.reward);
    toast.success(`+${res.reward} NC credited! 🎉`);
    setPhase("done");
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <Link to="/games" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Game</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Memory Match</span></h1>
        </div>
        <div className="ml-auto rounded-full border border-coin/40 bg-coin/10 px-3 py-1 text-[10px] font-bold uppercase text-coin">
          {remaining ?? "–"} / 5 left
        </div>
      </header>

      <main className="relative z-10 px-5 mt-5 space-y-5">
        <div className="glass rounded-3xl p-3 flex items-center justify-around">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Moves</p>
            <p className="text-2xl font-extrabold">{moves}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pairs</p>
            <p className="text-2xl font-extrabold text-gradient-neon">{matchedCount / 2}/{EMOJIS.length}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</p>
            <p className="text-2xl font-extrabold text-success">+1</p>
          </div>
        </div>

        {phase === "idle" ? (
          <div className="glass rounded-3xl p-8 text-center space-y-4">
            <Brain className="h-12 w-12 mx-auto text-accent" />
            <p className="text-sm text-muted-foreground">Saare pairs match karo aur +1 NC kamao.</p>
            <Button onClick={start} variant="hero" size="lg" className="w-full">Start Game</Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {deck.map((c) => (
              <button
                key={c.id}
                onClick={() => !c.flipped && !c.matched && flip(c.id)}
                disabled={phase !== "playing" || c.matched}
                className={cn(
                  "aspect-square rounded-2xl text-4xl font-bold transition-bounce active:scale-95 relative overflow-hidden",
                  c.matched
                    ? "bg-success/20 border-2 border-success/50"
                    : c.flipped
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "glass hover:shadow-glow"
                )}
              >
                {c.flipped || c.matched ? c.emoji : "?"}
              </button>
            ))}
          </div>
        )}

        {phase === "saving" && <p className="text-center text-sm text-muted-foreground">Saving…</p>}
        {phase === "done" && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">You earned</p>
              <p className="text-3xl font-extrabold text-gradient-coin">+{reward} NC</p>
              <p className="text-xs text-muted-foreground mt-1">{moves} moves</p>
            </div>
            <Button onClick={start} variant="hero" size="lg" className="w-full">Play Again</Button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default MemoryMatch;
