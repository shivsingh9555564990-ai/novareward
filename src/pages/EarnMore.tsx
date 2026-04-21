import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Brain, Coins, Disc3, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const NC_PER_INR = 12;

const EarnMore = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const needCoins = Number(params.get("need") ?? 1200);
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("coins").eq("id", user.id).maybeSingle()
      .then(({ data }) => setCoins(data?.coins ?? 0));
  }, [user]);

  const short = Math.max(0, needCoins - coins);
  const pct = Math.min(100, Math.round((coins / needCoins) * 100));

  const tasks = [
    { to: "/quiz", icon: <Brain className="h-5 w-5" />, title: "Daily Quiz", reward: "Up to 100 NC", time: "3 min", accent: "from-primary/30 to-accent/30" },
    { to: "/spin", icon: <Disc3 className="h-5 w-5" />, title: "Spin Wheel", reward: "1–5 NC", time: "instant", accent: "from-accent/30 to-secondary/30" },
    { to: "/scratch", icon: <Sparkles className="h-5 w-5" />, title: "Scratch Card", reward: "1–3 NC", time: "instant", accent: "from-secondary/30 to-primary/30" },
    { to: "/earn", icon: <Zap className="h-5 w-5" />, title: "Surveys & Tasks", reward: "50–360 NC", time: "2-9 min", accent: "from-coin/30 to-primary/30" },
  ];

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-xl font-extrabold">Almost there!</h1>
      </header>

      <main className="relative z-10 mt-6 px-5 space-y-5">
        <div className="glass rounded-3xl p-6 text-center shadow-glow">
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-coin shadow-coin flex items-center justify-center animate-float">
            <Coins className="h-9 w-9 text-coin-foreground" />
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">You need</p>
          <p className="text-5xl font-extrabold text-gradient-coin">{short.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">more Nova Coins · ≈ ₹{(short / NC_PER_INR).toFixed(0)}</p>
          <Progress value={pct} className="mt-4 h-2" />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {coins.toLocaleString()} / {needCoins.toLocaleString()} NC ({pct}%)
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          🚀 Just a few quick activities and you're ready to redeem.
        </p>

        <div className="space-y-2.5">
          {tasks.map((t, i) => (
            <Link key={t.title} to={t.to} className="glass relative block overflow-hidden rounded-2xl p-4 transition-bounce active:scale-[0.98] animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-r to-transparent opacity-30 ${t.accent}`} />
              <div className="relative flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow text-primary-foreground">
                  {t.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">{t.reward} · {t.time}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <Button variant="hero" size="xl" className="w-full" onClick={() => navigate("/earn")}>
          Go Earn Now <ArrowRight className="h-4 w-4" />
        </Button>
      </main>
      <BottomNav />
    </div>
  );
};

export default EarnMore;
