import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) return;
      const seenOnboarding = localStorage.getItem("coinbazaar-onboarded");
      if (user) navigate("/home", { replace: true });
      else if (seenOnboarding) navigate("/login", { replace: true });
      else navigate("/onboarding", { replace: true });
    }, 1800);
    return () => clearTimeout(t);
  }, [navigate, user, loading]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center relative overflow-hidden">
      {/* Floating coins */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-8 h-8 rounded-full bg-gradient-coin opacity-70 animate-float"
          style={{
            top: `${15 + i * 12}%`,
            left: `${10 + (i * 17) % 80}%`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center gap-6 animate-scale-in">
        <div className="relative">
          <div className="w-28 h-28 rounded-3xl bg-white/95 flex items-center justify-center shadow-glow animate-pulse-glow">
            <Coins className="w-14 h-14 text-primary" strokeWidth={2.5} />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-coin animate-float" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-primary-foreground mb-1">CoinBazaar</h1>
          <p className="text-primary-foreground/85 text-sm font-medium">Earn • Play • Redeem</p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
