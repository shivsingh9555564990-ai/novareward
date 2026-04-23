import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Timer, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFp } from "@/lib/deviceFp";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import AdSlot from "@/components/AdSlot";
import CreditLog from "@/components/CreditLog";

const DURATION = 15; // seconds — short rush, 1 NC reward

const TapCoin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<"idle" | "playing" | "saving" | "done">("idle");
  const [taps, setTaps] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reward, setReward] = useState(0);
  const [creditTick, setCreditTick] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    supabase
      .from("game_plays")
      .select("id", { count: "exact", head: true })
      .eq("game", "tap_coin")
      .eq("play_date", today)
      .then(({ count }) => setRemaining(5 - (count ?? 0)));
  }, [user, phase]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const start = () => {
    if (remaining !== null && remaining <= 0) {
      toast.error("Aaj ki 5 plays khatam ho gayi. Kal aana!");
      return;
    }
    setPhase("playing"); setTaps(0); setTime(DURATION);
    timerRef.current = window.setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const finish = async () => {
    setPhase("saving");
    const fp = getDeviceFp();
    const { data, error } = await supabase.rpc("play_game", {
      p_game: "tap_coin", p_score: taps, p_device_fp: fp,
    });
    if (error) { toast.error(error.message); setPhase("done"); return; }
    const res = data as any;
    if (!res?.success) {
      toast.error(res?.error === "daily_limit_reached" ? "Daily limit reached" : (res?.error ?? "Error"));
      setPhase("done"); return;
    }
    setReward(res.reward);
    toast.success(`+${res.reward} NC credited! 🎉`);
    setCreditTick((t) => t + 1);
    setPhase("done");
  };

  const handleTap = () => {
    if (phase !== "playing") return;
    setTaps((n) => n + 1);
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <Link to="/games" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Game</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Tap the Coin</span></h1>
        </div>
        <div className="ml-auto rounded-full border border-coin/40 bg-coin/10 px-3 py-1 text-[10px] font-bold uppercase text-coin">
          {remaining ?? "–"} / 5 left
        </div>
      </header>

      <main className="relative z-10 px-5 mt-6 space-y-5">
        <div className="glass rounded-3xl p-4 flex items-center justify-around">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Taps</p>
            <p className="text-3xl font-extrabold text-gradient-coin">{taps}</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-center"><Timer className="h-3 w-3" />Time</p>
            <p className="text-3xl font-extrabold">{time}s</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</p>
            <p className="text-3xl font-extrabold text-success">+1</p>
          </div>
        </div>

        <div className="relative aspect-square mx-auto max-w-sm">
          <button
            onClick={handleTap}
            disabled={phase !== "playing"}
            className="group relative h-full w-full rounded-full bg-gradient-coin shadow-coin active:scale-95 transition-bounce disabled:opacity-60"
            style={{ boxShadow: "0 0 80px hsl(var(--coin) / 0.6)" }}
          >
            <span className="absolute inset-2 rounded-full border-4 border-coin-foreground/30" />
            <span className="absolute inset-0 flex items-center justify-center">
              <Coins className="h-24 w-24 text-coin-foreground drop-shadow-2xl" />
            </span>
            {phase === "playing" && (
              <span className="absolute inset-0 rounded-full border-4 border-coin-foreground/40 animate-ping" />
            )}
          </button>
        </div>

        {phase === "idle" && (
          <Button onClick={start} variant="hero" size="lg" className="w-full">
            <Zap className="h-4 w-4" /> Start {DURATION}s Rush
          </Button>
        )}
        {phase === "playing" && (
          <p className="text-center text-sm text-muted-foreground">Jitna fast tap karo! Game khatam hone par +1 NC milega.</p>
        )}
        {phase === "saving" && <p className="text-center text-sm text-muted-foreground">Saving…</p>}
        {phase === "done" && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">You earned</p>
              <p className="text-3xl font-extrabold text-gradient-coin">+{reward} NC</p>
              <p className="text-xs text-muted-foreground mt-1">{taps} taps in {DURATION}s</p>
            </div>
            <CreditLog source="tap_coin" pollKey={creditTick} />
            <Button onClick={() => setPhase("idle")} variant="hero" size="lg" className="w-full">Play Again</Button>
          </div>
        )}
      </main>
      <AdSlot />
      <BottomNav />
    </div>
  );
};

export default TapCoin;
