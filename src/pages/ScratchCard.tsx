import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import AdSlot from "@/components/AdSlot";
import { toast } from "sonner";
import { getDeviceFp } from "@/lib/deviceFp";
import iconScratch from "@/assets/icon-scratch.png";

// Scratch reward: 1-3 NC (server-enforced max 3)
const REWARDS = [
  { reward: 1, weight: 50 },
  { reward: 2, weight: 35 },
  { reward: 3, weight: 15 },
];
const pickReward = () => {
  const total = REWARDS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const seg of REWARDS) {
    r -= seg.weight;
    if (r <= 0) return seg.reward;
  }
  return REWARDS[0].reward;
};

const ScratchCard = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [claimedToday, setClaimedToday] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const drawingRef = useRef(false);
  const claimLockRef = useRef(false);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_activity")
        .select("id, reward")
        .eq("activity", "scratch")
        .eq("activity_date", today)
        .maybeSingle();
      if (data) {
        setClaimedToday(true);
        setRevealed(true);
        setReward(data.reward);
      } else {
        setReward(pickReward());
      }
    })();
  }, []);

  useEffect(() => {
    if (claimedToday) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    grad.addColorStop(0, "hsl(270 95% 35%)");
    grad.addColorStop(0.5, "hsl(285 100% 45%)");
    grad.addColorStop(1, "hsl(320 100% 45%)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 22px Space Grotesk, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE", rect.width / 2, rect.height / 2 - 6);
    ctx.font = "12px Space Grotesk, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Drag to reveal your reward", rect.width / 2, rect.height / 2 + 18);
  }, [claimedToday, reward]);

  const scratch = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkReveal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    for (let i = 3; i < data.length; i += 4 * 50) {
      if (data[i] === 0) cleared++;
    }
    const pct = cleared / (data.length / (4 * 50));
    if (pct > 0.45 && !revealed) {
      setRevealed(true);
      handleClaim();
    }
  };

  const handleClaim = async () => {
    if (claimLockRef.current || claimedToday || reward === null) return;
    claimLockRef.current = true;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("claim_daily_activity", {
      p_activity: "scratch",
      p_reward: reward,
      p_meta: { device_fp: getDeviceFp() },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not credit reward");
      return;
    }
    const res = data as { success: boolean; error?: string };
    if (!res?.success) {
      const msg: Record<string, string> = {
        already_claimed_today: "Already claimed today",
        device_limit_reached: "This device already claimed today",
        reward_out_of_range: "Invalid reward",
      };
      toast.error(msg[res?.error || ""] || "Claim failed");
      setClaimedToday(true);
      return;
    }
    setClaimedToday(true);
    toast.success(`+${reward} Nova Coins credited!`);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    handleMove(e);
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    checkReveal();
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    scratch(e.clientX - rect.left, e.clientY - rect.top);
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="flex items-center gap-3 px-5 pt-8">
        <Link to="/earn" className="rounded-full bg-muted/60 p-2 backdrop-blur" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <img src={iconScratch} alt="Scratch" className="h-8 w-8" width={32} height={32} />
        <h1 className="text-xl font-extrabold">Scratch Card</h1>
        <span className="ml-auto rounded-full bg-secondary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
          Daily
        </span>
      </header>
      <p className="mt-2 px-5 text-sm text-muted-foreground">
        Reveal your hidden reward (1–3 NC) — credited instantly.
      </p>

      <div className="mt-8 flex justify-center px-5">
        <div className="relative">
          <div className="absolute -inset-6 rounded-3xl bg-secondary/30 blur-3xl animate-pulse-glow" />
          <div
            className="glass relative h-[260px] w-[320px] overflow-hidden rounded-3xl shadow-glow"
            style={{ background: "linear-gradient(135deg, hsl(255 40% 10%) 0%, hsl(270 50% 15%) 100%)" }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="grid-bg absolute inset-0 opacity-30" />
              <Sparkles className="h-7 w-7 text-accent animate-neon-pulse" />
              <p className="mt-2 text-xs uppercase tracking-widest text-accent">You Won</p>
              <p className="mt-1 text-5xl font-extrabold text-gradient-coin">+{reward ?? "—"}</p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Nova Coins</p>
            </div>
            {!claimedToday && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={handleMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 px-5">
        {claimedToday ? (
          <div className="space-y-2">
            <div className="glass rounded-2xl p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-success">Credited</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">
                +{reward} <span className="text-sm text-muted-foreground">Nova Coins</span>
              </p>
            </div>
            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/wallet")}>
              View Wallet
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/earn")}>
              Back to Earn
            </Button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {submitting ? "Crediting…" : revealed ? "Crediting your reward…" : "Drag your finger across the card"}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2 px-5">
        {["Server-validated", "Anti-fraud", "Max 3 NC"].map((t) => (
          <span key={t} className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {t}
          </span>
        ))}
      </div>

      <AdSlot />
      <BottomNav />
    </div>
  );
};

export default ScratchCard;
