import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { routeAfterAuth } from "@/lib/routeAfterAuth";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show account hint when redirected from device-conflict checks.
  useEffect(() => {
    const hint = params.get("email_hint");
    if (params.get("device_blocked") === "1") {
      const suffix = hint ? ` (${hint})` : "";
      toast.error(
        `⚠️ Is device pe pehle se ek account hai${suffix}. Naya account allowed nahi — usi email se login karo.`,
        { duration: 9000 }
      );
    }
  }, [params]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        toast.error("⚠️ Email verify नहीं हुआ। अपना inbox check करके confirmation link पर click करें।", { duration: 7000 });
        return;
      }
      if (msg.includes("invalid")) {
        toast.error("❌ गलत email या password। अगर अभी signup किया है तो पहले email verify करें।", { duration: 6000 });
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back! 🎉");
    const dest = data.user ? await routeAfterAuth(data.user.id) : "/home";
    navigate(dest, { replace: true });
  };

  const handleGoogle = async () => {
    // Direct Supabase OAuth — works on ANY host (Vercel, Netlify, custom domains).
    // Supabase redirects user to Google, then back to /auth/callback on this domain.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      toast.error(error.message || "Google sign-in failed");
    }
    // Browser will redirect to Google — no further code runs here.
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Login करके अपनी earnings continue करें">
      <form onSubmit={handleLogin} className="space-y-4">
        {params.get("email_hint") && (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Use this email</p>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">
              {params.get("email_hint")}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11 h-12 rounded-2xl"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="password"
              // Always rendered as text so we can mask everything except last 3 chars
              // (mobile-keyboard style). Eye icon toggles full reveal.
              type="text"
              placeholder="••••••"
              value={
                showPwd || password.length <= 3
                  ? password
                  : "•".repeat(password.length - 3) + password.slice(-3)
              }
              onChange={(e) => {
                const next = e.target.value;
                if (showPwd) {
                  setPassword(next);
                  return;
                }
                // Reconstruct real password from masked display:
                // any "•" keeps the original char at that index, everything else
                // is what the user just typed.
                let rebuilt = "";
                for (let i = 0; i < next.length; i++) {
                  const ch = next[i];
                  rebuilt += ch === "•" ? password[i] ?? "" : ch;
                }
                setPassword(rebuilt);
              }}
              autoComplete="current-password"
              className="pl-11 pr-11 h-12 rounded-2xl tracking-wider"
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary font-medium hover:underline">
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">या</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" size="lg" onClick={handleGoogle}>
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => toast.info("Biometric login native app में available होगा")}
        >
          <Fingerprint className="w-5 h-5" />
          Biometric
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        New here?{" "}
        <Link to="/register" className="text-primary font-semibold hover:underline">
          Create Account
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
