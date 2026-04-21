import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import novaLogo from "@/assets/nova-logo.png";

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) return;
      const seenOnboarding = localStorage.getItem("novarewards-onboarded");
      if (user) navigate("/home", { replace: true });
      else if (seenOnboarding) navigate("/login", { replace: true });
      else navigate("/onboarding", { replace: true });
    }, 2200);
    return () => clearTimeout(t);
  }, [navigate, user, loading]);

  return (
    <div className="min-h-screen bg-gradient-hero grid-bg flex items-center justify-center relative overflow-hidden">
      {/* Scanning neon line */}
      <div className="absolute inset-x-0 h-px bg-gradient-neon shadow-neon animate-scan" />

      {/* Floating orbs */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-primary shadow-glow animate-float"
          style={{
            top: `${10 + (i * 11) % 80}%`,
            left: `${8 + (i * 19) % 84}%`,
            animationDelay: `${i * 0.25}s`,
            opacity: 0.6,
          }}
        />
      ))}

      {/* Glow halos behind logo */}
      <div className="absolute w-80 h-80 rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
      <div className="absolute w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-scale-in">
        {/* Orbiting particles */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-3 h-3 rounded-full bg-accent shadow-neon animate-orbit" style={{ animationDuration: "6s" }} />
            <div className="absolute w-2 h-2 rounded-full bg-secondary shadow-neon animate-orbit" style={{ animationDuration: "9s", animationDelay: "-2s" }} />
            <div className="absolute w-2 h-2 rounded-full bg-coin shadow-coin animate-orbit" style={{ animationDuration: "7s", animationDelay: "-4s" }} />
          </div>

          <img
            src={novaLogo}
            alt="NovaRewards logo"
            width={160}
            height={160}
            className="w-40 h-40 rounded-3xl shadow-glow animate-pulse-glow relative z-10"
          />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="text-foreground">Nova</span>
            <span className="text-success">Rewards</span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium tracking-[0.3em] uppercase">
            Earn · Play · Redeem
          </p>
          <p className="text-xs text-primary/80 font-mono tracking-widest pt-2">// FUTURE OF REWARDS · v3.0</p>
        </div>

        {/* Loading indicator */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-pulse-glow"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Splash;
