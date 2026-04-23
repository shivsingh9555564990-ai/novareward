import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Universal auth callback handler.
 * Supabase email links redirect here with tokens in the URL hash
 * (or `?code=` for PKCE). We exchange them for a session, then
 * route the user to the right page based on the auth event type.
 *
 * IMPORTANT: This route must be in the Supabase "Redirect URLs"
 * allow-list for EVERY domain you host the app on.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = url.searchParams;

        // Detect error returned by Supabase
        const errDesc =
          hashParams.get("error_description") ||
          queryParams.get("error_description");
        if (errDesc) {
          toast.error(decodeURIComponent(errDesc));
          navigate("/login", { replace: true });
          return;
        }

        // Type tells us what kind of email link this was
        const type =
          hashParams.get("type") || queryParams.get("type") || "";

        // PKCE flow: ?code=...
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) {
            toast.error(error.message);
            navigate("/login", { replace: true });
            return;
          }
        } else {
          // Implicit flow: tokens come in the hash. The Supabase client
          // auto-detects them on init, but we wait briefly for the session.
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              toast.error(error.message);
              navigate("/login", { replace: true });
              return;
            }
          }
        }

        // Clean the URL (remove tokens from the address bar)
        window.history.replaceState({}, document.title, "/auth/callback");

        // Route based on the auth event
        if (type === "recovery") {
          navigate("/reset-password", { replace: true });
          return;
        }

        // signup / magiclink / email_change / invite / oauth → continue into app
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const { routeAfterAuth } = await import("@/lib/routeAfterAuth");
          const dest = await routeAfterAuth(data.session.user.id);
          if (dest === "/home") {
            toast.success("Welcome back! 🎉");
          } else {
            toast.success("✅ Verified! Welcome 🎉");
          }
          navigate(dest, { replace: true });
        } else {
          toast.success("✅ Email verified! कृपया login करें।");
          navigate("/login", { replace: true });
        }
      } catch (e) {
        console.error("Auth callback error:", e);
        setMessage("Something went wrong");
        toast.error("Verification failed. कृपया दोबारा try करें।");
        setTimeout(() => navigate("/login", { replace: true }), 1500);
      }
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl bg-primary/40 rounded-full" />
        <Loader2 className="relative w-12 h-12 text-primary animate-spin" />
      </div>
      <p className="text-foreground font-semibold">{message}</p>
      <p className="text-sm text-muted-foreground">
        एक second... आपको सही जगह redirect कर रहे हैं
      </p>
    </div>
  );
};

export default AuthCallback;
