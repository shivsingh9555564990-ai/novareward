import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Weighted reward segments (sum of weights = 100)
const SEGMENTS = [
  { reward: 10, weight: 30, color: "hsl(190 100% 60%)" },
  { reward: 25, weight: 22, color: "hsl(270 95% 65%)" },
  { reward: 50, weight: 18, color: "hsl(320 100% 65%)" },
  { reward: 75, weight: 12, color: "hsl(45 100% 60%)" },
  { reward: 100, weight: 9, color: "hsl(152 80% 50%)" },
  { reward: 200, weight: 6, color: "hsl(190 100% 60%)" },
  { reward: 350, weight: 2, color: "hsl(285 100% 72%)" },
  { reward: 500, weight: 1, color: "hsl(45 100% 60%)" },
];

const pickReward = () => {
  const total = SEGMENTS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
};

const SpinWheel = () => {
  const navigate = useNavigate();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [claimedToday, setClaimedToday] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_activity")
        .select("id, reward")
        .eq("activity", "spin")
        .eq("activity_date", today)
        .maybeSingle();
      if (data) {
        setClaimedToday(true);
        setResult(data.reward);
      }
    })();
  }, []);

  const segmentAngle = 360 / SEGMENTS.length;

  const handleSpin = async () => {
    if (spinning || claimedToday || lockRef.current) return;
    lockRef.current = true;
    setSpinning(true);

    const idx = pickReward();
    const reward = SEGMENTS[idx].reward;

    // pointer is at top — rotate so chosen segment lands at top
    const targetMid = idx * segmentAngle + segmentAngle / 2;
    const final = 360 * 6 + (360 - targetMid); // 6 full spins
    setRotation((prev) => prev + final - (prev % 360));

    setTimeout(async () => {
      const { data, error } = await supabase.rpc("claim_daily_activity", {
        p_activity: "spin",
        p_reward: reward,
        p_meta: { segment: idx },
      });
      setSpinning(false);
      lockRef.current = false;

      if (error) {
        toast.error("Spin failed. Try again.");
        return;
      }
      const res = data as { success: boolean; error?: string; reward?: number };
      if (!res?.success) {
        toast.error(res?.error === "already_claimed_today" ? "Already spun today" : "Spin failed");
        setClaimedToday(true);
        return;
      }
      setResult(reward);
      setClaimedToday(true);
      toast.success(`+${reward} Nova Coins credited!`, { description: "Check wallet" });
    }, 4500);
  };

  const segments = useMemo(
    () =>
      SEGMENTS.map((s, i) => {
        const start = i * segmentAngle;
        return { ...s, start };
      }),
    [segmentAngle]
  );

  // SVG paths for wheel slices
  const cx = 150;
  const cy = 150;
  const r = 140;
  const polarToCart = (angleDeg: number) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="flex items-center gap-3 px-5 pt-8">
        <Link to="/earn" className="rounded-full bg-muted/60 p-2 backdrop-blur" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-extrabold">Spin Wheel</h1>
        <span className="ml-auto rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
          Daily
        </span>
      </header>

      <p className="mt-2 px-5 text-sm text-muted-foreground">
        Spin once every 24 hours. Rewards credited instantly to your Nova wallet.
      </p>

      {/* Wheel */}
      <div className="relative mt-8 flex items-center justify-center">
        <div className="absolute h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
        <div className="relative">
          {/* Pointer */}
          <div
            className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "22px solid hsl(var(--primary))",
              filter: "drop-shadow(0 0 12px hsl(var(--primary)))",
            }}
          />
          <svg
            viewBox="0 0 300 300"
            width={300}
            height={300}
            className="relative z-10 transition-transform"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: spinning ? "4500ms" : "0ms",
              transitionTimingFunction: "cubic-bezier(0.17, 0.67, 0.16, 0.99)",
              filter: "drop-shadow(0 0 30px hsl(var(--primary) / 0.6))",
            }}
          >
            <defs>
              <radialGradient id="wheelGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(255 40% 12%)" />
                <stop offset="100%" stopColor="hsl(250 45% 6%)" />
              </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r + 6} fill="url(#wheelGrad)" stroke="hsl(270 95% 65%)" strokeWidth="2" />
            {segments.map((s, i) => {
              const [x1, y1] = polarToCart(s.start);
              const [x2, y2] = polarToCart(s.start + segmentAngle);
              const largeArc = segmentAngle > 180 ? 1 : 0;
              const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              const labelAngle = s.start + segmentAngle / 2;
              const [lx, ly] = (() => {
                const a = ((labelAngle - 90) * Math.PI) / 180;
                return [cx + r * 0.65 * Math.cos(a), cy + r * 0.65 * Math.sin(a)];
              })();
              return (
                <g key={i}>
                  <path d={path} fill={s.color} fillOpacity={0.85} stroke="hsl(250 45% 6%)" strokeWidth={1.5} />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="16"
                    fontWeight="800"
                    fill="hsl(250 50% 8%)"
                    transform={`rotate(${labelAngle} ${lx} ${ly})`}
                  >
                    +{s.reward}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={28} fill="hsl(255 40% 10%)" stroke="hsl(270 95% 65%)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r={10} fill="hsl(285 100% 72%)" />
          </svg>
        </div>
      </div>

      {/* Action */}
      <div className="mt-10 px-5">
        {result !== null && (
          <div className="glass mb-4 rounded-2xl p-4 text-center animate-scale-in">
            <p className="text-xs uppercase tracking-widest text-accent">Today's Reward</p>
            <p className="mt-1 text-3xl font-extrabold text-gradient-coin">+{result} NC</p>
          </div>
        )}
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={handleSpin}
          disabled={spinning || claimedToday}
        >
          <Sparkles className="h-5 w-5" />
          {claimedToday ? "Come back tomorrow" : spinning ? "Spinning…" : "Spin Now"}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate("/wallet")}>
          View Wallet
        </Button>
      </div>

      {/* Info chips */}
      <div className="mt-6 flex flex-wrap justify-center gap-2 px-5">
        {["Server-validated", "Anti-fraud", "Instant credit"].map((t) => (
          <span
            key={t}
            className={cn(
              "rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary"
            )}
          >
            {t}
          </span>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default SpinWheel;
