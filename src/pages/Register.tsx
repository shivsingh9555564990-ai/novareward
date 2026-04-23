import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Phone, User, Lock, Eye, EyeOff, Gift, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getDeviceFp } from "@/lib/deviceFp";
import { toast } from "sonner";

const Register = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceWarning, setDeviceWarning] = useState<{ message: string; emailHint: string | null } | null>(null);

  useEffect(() => {
    const ref = params.get("ref");
    if (ref) {
      const clean = ref.toUpperCase().trim().slice(0, 8);
      setReferralCode(clean);
      localStorage.setItem("pending_ref", clean);
    } else {
      const stored = localStorage.getItem("pending_ref");
      if (stored) setReferralCode(stored);
    }
  }, [params]);

  // Check device fingerprint on mount — does this device already have an account?
  useEffect(() => {
    (async () => {
      try {
        const fp = getDeviceFp();
        const { data } = await supabase.rpc("check_device_signup", { p_device_fp: fp });
        const res = data as any;
        if (res?.exists) {
          setDeviceWarning({
            message: res.email_hint
              ? `Is device se already account hai. Wahi email use karo:`
              : "Is device se already ek account bana hai. Pehle wale account se login karo.",
            emailHint: res.email_hint ?? null,
          });
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceWarning) {
      toast.error("Is device pe pehle se account hai. Login karo.", { duration: 6000 });
      setTimeout(() => navigate("/login", { replace: true }), 1500);
      return;
    }
    if (password.length < 6) {
      toast.error("Password कम से कम 6 characters का हो");
      return;
    }
    if (referralCode.trim()) localStorage.setItem("pending_ref", referralCode.trim().toUpperCase());
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        toast.error("⚠️ यह email पहले से registered है। नया confirmation email नहीं भेजा जाएगा — सीधे Login करें।", { duration: 7000 });
        setTimeout(() => navigate("/login", { replace: true }), 1200);
        return;
      }
      toast.error(error.message);
      return;
    }
    // Supabase returns a fake user object (identities: []) when email already exists
    // to prevent email enumeration. Detect and redirect to login instead of re-sending.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast.error("⚠️ यह email पहले से registered है। Confirmation email दोबारा नहीं भेजा गया — सीधे Login करें।", { duration: 7000 });
      setTimeout(() => navigate("/login", { replace: true }), 1200);
      return;
    }
    // If email confirmation required, no session is returned
    if (!data.session) {
      toast.success("✅ Confirmation link आपके email पर भेज दिया गया है। Email check करके verify करें, फिर login करें।", {
        duration: 8000,
      });
      navigate("/login", { replace: true });
      return;
    }
    // Auto-confirmed (rare case)
    toast.success("Account बन गया! 🎉");
    navigate("/profile-setup", { replace: true });
  };

  const handlePhoneSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      toast.error("सही phone number डालें");
      return;
    }
    toast.error(
      "📱 Phone OTP अभी available नहीं है। SMS provider (Twilio/MSG91) configure करना होगा। कृपया Email signup use करें।",
      { duration: 7000 }
    );
  };

  const handleGoogle = async () => {
    if (deviceWarning) {
      toast.error("Is device pe pehle se account hai. Login screen pe Google use karo.", { duration: 6000 });
      setTimeout(() => navigate("/login", { replace: true }), 1500);
      return;
    }
    if (referralCode.trim()) localStorage.setItem("pending_ref", referralCode.trim().toUpperCase());
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      return;
    }
    if (!result.redirected) {
      toast.success("Welcome! 🎉");
      navigate("/home", { replace: true });
    }
  };

  // Build a login URL that pre-fills the previously-used email when known.
  const loginHref = deviceWarning?.emailHint
    ? `/login?email=${encodeURIComponent(deviceWarning.emailHint)}`
    : "/login";

  return (
    <AuthLayout title="Create Account" subtitle="कुछ ही seconds में join करें और earning शुरू करें" back="/onboarding">
      {deviceWarning && (
        <div className="mb-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm flex-1">
              <p className="font-semibold text-destructive">Account already exists on this device</p>
              <p className="text-muted-foreground text-xs">{deviceWarning.message}</p>
              {deviceWarning.emailHint && (
                <p className="font-mono text-sm font-bold text-foreground bg-background/60 rounded-lg px-3 py-2 mt-2 inline-block">
                  {deviceWarning.emailHint}
                </p>
              )}
            </div>
          </div>
          <Link to={loginHref} className="block">
            <Button variant="hero" size="sm" className="w-full">
              Go to Login{deviceWarning.emailHint ? ` as ${deviceWarning.emailHint}` : ""} →
            </Button>
          </Link>
        </div>
      )}
      {/* Mode Toggle */}
      <div className="flex bg-muted rounded-full p-1 mb-6">
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-smooth ${
            mode === "email" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
          }`}
        >
          <Mail className="w-4 h-4 inline mr-1" /> Email
        </button>
        <button
          type="button"
          onClick={() => setMode("phone")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition-smooth ${
            mode === "phone" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
          }`}
        >
          <Phone className="w-4 h-4 inline mr-1" /> Phone
        </button>
      </div>

      {mode === "email" ? (
        <form onSubmit={handleEmailSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
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
                type={showPwd ? "text" : "password"}
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-11 h-12 rounded-2xl"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral">
              Referral Code <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-coin" />
              <Input
                id="referral"
                placeholder="ABCD1234"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 8))}
                className="pl-11 h-12 rounded-2xl uppercase tracking-wider"
                maxLength={8}
              />
            </div>
            {referralCode && (
              <p className="text-[11px] text-success flex items-center gap-1">
                <Gift className="w-3 h-3" /> Aapko +25 NC welcome bonus milega friend ki first earning par.
              </p>
            )}
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handlePhoneSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative flex">
              <span className="inline-flex items-center px-4 h-12 rounded-l-2xl border border-r-0 border-input bg-muted text-sm font-medium">
                +91
              </span>
              <Input
                id="phone"
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="rounded-l-none rounded-r-2xl h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full">
            Send OTP
          </Button>
        </form>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">या</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" size="lg" className="w-full" onClick={handleGoogle}>
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground mt-6">
        पहले से account है?{" "}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
