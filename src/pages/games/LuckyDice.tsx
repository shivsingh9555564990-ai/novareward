import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Dices } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFp } from "@/lib/deviceFp";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import AdSlot from "@/components/AdSlot";

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

const LuckyDice = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<"idle" | "rolling" | "saving" | "done">("idle");
  const [d1, setD1] = useState(0);
  const [d2, setD2] = useState(0);
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
      .eq("game", "lucky_dice")
      .eq("play_date", today)
      .then(({ count }) => setRemaining(1 - (count ?? 0)));
  }, [user, phase]);

  const roll = async () => {
    if (remaining !== null && remaining <= 0) {
      toast.error("Aaj ka ek roll khatam. Kal aana!");
      return;
    }
    setPhase("rolling");
    let ticks = 0;
    const interval = window.setInterval(() => {
      setD1(Math.floor(Math.random() * 6));
      setD2(Math.floor(Math.random() * 6));
      ticks++;
      if (ticks > 12) {
        window.clearInterval(interval);
        finish();
      }
    }, 80);
  };

  const finish = async () => {
    const final1 = Math.floor(Math.random() * 6);
    const final2 = Math.floor(Math.random() * 6);
    setD1(final1); setD2(final2);
    setPhase("saving");
    const total = (final1 + 1) + (final2 + 1);
    const fp = getDeviceFp();
    const { data, error } = await supabase.rpc("play_game", {
      p_game: "lucky_dice", p_score: total, p_device_fp: fp,
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
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Lucky Dice</span></h1>
        </div>
        <div className="ml-auto rounded-full border border-coin/40 bg-coin/10 px-3 py-1 text-[10px] font-bold uppercase text-coin">
          {remaining ?? "–"} / 1 left
        </div>
      </header>

      <main className="relative z-10 px-5 mt-8 space-y-6">
        <div className="flex justify-center gap-6">
          {[d1, d2].map((d, i) => (
            <div
              key={i}
              className="h-32 w-32 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center text-7xl text-primary-foreground"
              style={{ transform: phase === "rolling" ? "rotate(15deg)" : "rotate(0)", transition: "transform 0.2s" }}
            >
              {phase === "idle" ? "?" : FACES[d]}
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-4xl font-extrabold text-gradient-coin">
            {phase === "idle" ? "—" : (d1 + 1) + (d2 + 1)}
          </p>
        </div>

        {phase === "idle" && (
          <>
            <Button onClick={roll} variant="hero" size="lg" className="w-full">
              <Dices className="h-4 w-4" /> Roll Dice
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Reward: 1–5 NC based on roll · 1 roll per day
            </p>
          </>
        )}
        {phase === "rolling" && (
          <p className="text-center text-sm text-muted-foreground animate-pulse">Rolling…</p>
        )}
        {phase === "saving" && <p className="text-center text-sm text-muted-foreground">Saving…</p>}
        {phase === "done" && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">You earned</p>
              <p className="text-3xl font-extrabold text-gradient-coin">+{reward} NC</p>
            </div>
            <Button onClick={() => setPhase("idle")} variant="hero" size="lg" className="w-full">Roll Again</Button>
          </div>
        )}
      </main>
      <AdSlot />
      <BottomNav />
    </div>
  );
};

export default LuckyDice;
