import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const scorePassword = (pw: string): { score: number; label: string; color: string } => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return { score: s, label: "Weak", color: "bg-destructive" };
  if (s === 3) return { score: s, label: "Medium", color: "bg-coin" };
  return { score: s, label: "Strong", color: "bg-success" };
};

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const strength = scorePassword(next);
  const matchOk = next.length > 0 && next === confirm;
  const canSubmit =
    current.length >= 1 &&
    next.length >= 8 &&
    matchOk &&
    next !== current &&
    !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (next !== confirm) return toast.error("New passwords don't match");
    if (next === current) return toast.error("New password must differ from current");
    if (next.length < 8) return toast.error("Password must be at least 8 characters");

    setBusy(true);
    // Verify current password by attempting a sign-in.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (verifyErr) {
      setBusy(false);
      toast.error("Current password is incorrect");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("✅ Password updated");
    setCurrent("");
    setNext("");
    setConfirm("");
    navigate("/profile");
  };

  if (loading || !user) return null;

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative z-10 px-5 pt-10 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-xl glass flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Security</p>
          <h1 className="text-2xl font-extrabold leading-tight">Change Password</h1>
        </div>
      </header>

      <main className="relative z-10 px-5">
        <Card className="glass p-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Current password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="cur"
                  type={showCur ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-2xl"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCur((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle visibility"
                >
                  {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New password</Label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="new"
                  type={showNew ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-2xl"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle visibility"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {next.length > 0 && (
                <div>
                  <div className="flex h-1.5 gap-1 mt-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 rounded-full transition-colors",
                          i < strength.score ? strength.color : "bg-muted/50"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Strength: <span className="font-bold">{strength.label}</span> · 8+ chars, mix of letters, numbers & symbols
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showNew ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-11 pr-11 h-12 rounded-2xl"
                  required
                  autoComplete="new-password"
                />
                {matchOk && (
                  <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-success" />
                )}
              </div>
              {confirm.length > 0 && !matchOk && (
                <p className="text-[11px] text-destructive">Passwords don't match</p>
              )}
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={!canSubmit}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default ChangePassword;
