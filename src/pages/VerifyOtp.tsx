import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const OTP_LEN = 6;

const VerifyOtp = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phone = params.get("phone") || "your number";
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [seconds, setSeconds] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (!data) return;
    const arr = data.split("").concat(Array(OTP_LEN).fill("")).slice(0, OTP_LEN);
    setOtp(arr);
    refs.current[Math.min(data.length, OTP_LEN - 1)]?.focus();
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== OTP_LEN) {
      toast.error("पूरा OTP डालें");
      return;
    }
    // Demo: accept any 6-digit code
    toast.success("Verified! 🎉");
    navigate("/profile-setup", { replace: true });
  };

  return (
    <AuthLayout title="Verify OTP" subtitle={`+91 ${phone} पर 6-digit code भेजा गया है`} back="/register">
      <form onSubmit={verify} className="space-y-6">
        <div className="flex justify-between gap-2" onPaste={handlePaste}>
          {otp.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              inputMode="numeric"
              maxLength={1}
              className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 border-input bg-card focus:border-primary focus:outline-none transition-smooth"
            />
          ))}
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full">
          Verify & Continue
        </Button>

        <div className="text-center text-sm">
          {seconds > 0 ? (
            <span className="text-muted-foreground">
              Resend OTP in <span className="font-semibold text-foreground">{seconds}s</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSeconds(30);
                toast.success("OTP फिर से भेजा गया");
              }}
              className="text-primary font-semibold hover:underline"
            >
              Resend OTP
            </button>
          )}
        </div>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        गलत number?{" "}
        <Link to="/register" className="text-primary font-semibold hover:underline">
          Change
        </Link>
      </p>
    </AuthLayout>
  );
};

export default VerifyOtp;
