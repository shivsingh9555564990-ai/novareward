import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const INTERESTS = [
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "tech", label: "Tech & Gadgets", emoji: "📱" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "food", label: "Food & Dining", emoji: "🍕" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "movies", label: "Movies & TV", emoji: "🎬" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "automotive", label: "Cars & Bikes", emoji: "🚗" },
];

const Interests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (selected.length < 3) {
      toast.error("कम से कम 3 interests चुनें");
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ interests: selected, onboarded: true })
      .eq("id", user.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("All set! 🎉 Welcome to CoinBazaar");
    navigate("/home", { replace: true });
  };

  return (
    <AuthLayout
      title="Pick Your Interests"
      subtitle={`AI आपके लिए best surveys और offers match करेगा (${selected.length} selected)`}
    >
      <div className="grid grid-cols-2 gap-3 mb-6">
        {INTERESTS.map((it) => {
          const isSel = selected.includes(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              className={`relative p-4 rounded-2xl text-left transition-bounce ${
                isSel
                  ? "bg-gradient-primary text-primary-foreground shadow-glow scale-[1.02]"
                  : "bg-card border-2 border-border hover:border-primary/40"
              }`}
            >
              <div className="text-3xl mb-2">{it.emoji}</div>
              <div className="font-semibold text-sm">{it.label}</div>
              {isSel && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Button
        variant="hero"
        size="lg"
        className="w-full"
        onClick={save}
        disabled={loading || selected.length < 3}
      >
        {loading ? "Saving..." : "Finish Setup"}
      </Button>
    </AuthLayout>
  );
};

export default Interests;
