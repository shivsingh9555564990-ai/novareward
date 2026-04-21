import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Coins, LogOut, Sparkles, Gift, Zap, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  coins: number;
  interests: string[];
}

const Home = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url, coins, interests")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-gradient-primary animate-pulse-glow" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg pb-20">
      {/* Header */}
      <header className="px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-2xl shadow-glow">
              {profile?.avatar_url || "👤"}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <p className="font-bold">{profile?.full_name || "User"} 👋</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await signOut();
              toast.success("Logged out");
              navigate("/login");
            }}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>

        {/* Coin balance card */}
        <div className="relative bg-gradient-primary rounded-3xl p-6 shadow-glow overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -right-12 -bottom-8 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-primary-foreground/80 text-sm mb-1">Total Balance</p>
            <div className="flex items-baseline gap-2 mb-4">
              <Coins className="w-7 h-7 text-coin animate-coin-spin" />
              <span className="text-4xl font-extrabold text-primary-foreground">
                {profile?.coins?.toLocaleString() ?? 0}
              </span>
              <span className="text-primary-foreground/80">coins</span>
            </div>
            <p className="text-primary-foreground/80 text-xs">
              ≈ ₹{((profile?.coins ?? 0) / 37.5).toFixed(2)}
            </p>
          </div>
        </div>
      </header>

      {/* Phase 1 complete callout */}
      <section className="px-6 mb-6">
        <div className="bg-card rounded-3xl p-6 shadow-soft border-2 border-success/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-success flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-success-foreground" />
            </div>
            <div>
              <p className="font-bold">Phase 1 Complete! 🎉</p>
              <p className="text-xs text-muted-foreground">Auth + Onboarding ready</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            आपका account ready है। अगले phases में Earning, Wallet, Redeem, और Gamification add होंगे।
          </p>
          <p className="text-sm font-semibold">
            Selected interests: <span className="text-primary">{profile?.interests?.length ?? 0}</span>
          </p>
        </div>
      </section>

      {/* Coming soon previews */}
      <section className="px-6">
        <h2 className="text-lg font-bold mb-3">Coming in Next Phases</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Zap, label: "Earn", desc: "Surveys, tasks, ads", color: "bg-gradient-coin" },
            { icon: Gift, label: "Redeem", desc: "Gift cards, UPI", color: "bg-gradient-success" },
            { icon: Trophy, label: "Leaderboard", desc: "Compete & win", color: "bg-gradient-primary" },
            { icon: Coins, label: "Wallet", desc: "Track earnings", color: "bg-gradient-hero" },
          ].map((card) => (
            <div key={card.label} className="bg-card rounded-2xl p-4 shadow-soft">
              <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-sm">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
