import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, X, Clock, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Avatar } from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import iconRequests from "@/assets/icon-requests.png";
import { cn } from "@/lib/utils";

type Req = {
  request_id: string;
  other_user_id: string;
  name: string;
  avatar_url: string | null;
  coins: number;
  created_at: string;
  direction: "incoming" | "outgoing";
};

const FriendRequests = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [list, setList] = useState<Req[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc("list_friend_requests", { p_box: tab });
    if (error) toast.error(error.message);
    setList((data ?? []) as Req[]);
    setFetching(false);
  };

  useEffect(() => { if (user) load(); }, [user, tab]);

  const accept = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("accept_friend_request", { p_request_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((r) => r.request_id !== id));
    toast.success("Friend added 🎉");
  };

  const decline = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("decline_friend_request", { p_request_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((r) => r.request_id !== id));
    toast.success("Request declined");
  };

  const cancel = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("cancel_friend_request", { p_request_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setList((l) => l.filter((r) => r.request_id !== id));
    toast.success("Request cancelled");
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-coin/20 blur-3xl" />

      <header className="relative z-10 px-5 pt-8 flex items-center gap-3">
        <Link to="/friends" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Community</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Requests</span></h1>
        </div>
        <img src={iconRequests} alt="" aria-hidden="true" loading="lazy" width={56} height={56} className="ml-auto h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--coin)/0.7)]" />
      </header>

      <main className="relative z-10 px-4 mt-4 space-y-4">
        <div className="glass rounded-full p-1 flex">
          {(["incoming", "outgoing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-smooth",
                tab === t ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              )}
            >
              {t === "incoming" ? "Incoming" : "Sent"}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {fetching ? (
            [0, 1].map((i) => <div key={i} className="glass h-20 animate-pulse rounded-2xl" />)
          ) : list.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {tab === "incoming" ? "Koi naya request nahi 📭" : "Koi request nahi bheji."}
            </div>
          ) : (
            list.map((r, i) => (
              <div
                key={r.request_id}
                className="glass relative flex items-center gap-3 rounded-2xl p-3 animate-slide-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Link to={`/u/${r.other_user_id}`} className="flex flex-1 items-center gap-3 min-w-0">
                  <Avatar name={r.name} src={r.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-coin" />{r.coins.toLocaleString()}</span>
                      <span>· {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
                {tab === "incoming" ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => accept(r.request_id)}
                      disabled={busy === r.request_id}
                      className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center active:scale-95 disabled:opacity-50"
                      aria-label="Accept"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => decline(r.request_id)}
                      disabled={busy === r.request_id}
                      className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center active:scale-95 disabled:opacity-50"
                      aria-label="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => cancel(r.request_id)}
                    disabled={busy === r.request_id}
                    className="gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" /> Cancel
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default FriendRequests;
