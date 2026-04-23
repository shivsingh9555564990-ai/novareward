import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const AVATARS = ["🦊", "🐼", "🦁", "🐯", "🐸", "🦄", "🐵", "🐧"];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Skip this screen if the user has already finished setup once.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.onboarded) {
        navigate("/home", { replace: true });
        return;
      }
      if (data?.full_name && data?.avatar_url) {
        navigate("/interests", { replace: true });
        return;
      }
      // Pre-fill from any existing data / OAuth metadata
      if (data?.full_name) setName(data.full_name);
      else if (user.user_metadata?.full_name) setName(user.user_metadata.full_name);
      if (data?.avatar_url) setAvatar(data.avatar_url);
      setChecking(false);
    })();
  }, [user, authLoading, navigate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Pehle login करें");
      navigate("/login");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, avatar_url: avatar })
      .eq("id", user.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate("/interests", { replace: true });
  };

  return (
    <AuthLayout title="Setup Profile" subtitle="अपना avatar और नाम चुनें">
      <form onSubmit={save} className="space-y-6">
        {/* Selected avatar preview */}
        <div className="flex justify-center">
          <div className="w-28 h-28 rounded-full bg-gradient-primary flex items-center justify-center text-6xl shadow-glow animate-scale-in">
            {avatar}
          </div>
        </div>

        {/* Avatar grid */}
        <div>
          <Label className="mb-3 block">Choose Avatar</Label>
          <div className="grid grid-cols-4 gap-3">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`aspect-square rounded-2xl text-3xl flex items-center justify-center transition-bounce ${
                  avatar === a
                    ? "bg-gradient-primary shadow-glow scale-105"
                    : "bg-muted hover:bg-primary/10"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="आपका नाम"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-11 h-12 rounded-2xl"
              required
            />
          </div>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? "Saving..." : "Continue"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ProfileSetup;
