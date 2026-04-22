import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { UserCard, UserSummary } from "@/components/UserCard";
import { toast } from "sonner";
import iconDiscover from "@/assets/icon-discover.png";

const Discover = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const load = useCallback(async (q: string) => {
    setFetching(true);
    const { data, error } = await supabase.rpc("search_users", { p_query: q, p_limit: 30 });
    if (error) toast.error(error.message);
    setResults((data ?? []) as UserSummary[]);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, user, load]);

  const updateInPlace = (id: string, patch: Partial<UserSummary>) =>
    setResults((rs) => rs.map((r) => (r.user_id === id ? { ...r, ...patch } : r)));

  const handleAdd = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.rpc("send_friend_request", { p_receiver: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    const res = data as any;
    if (!res?.success) return toast.error(res?.error ?? "Could not send");
    updateInPlace(id, { request_outgoing: true });
    toast.success("Friend request sent");
  };

  const handleAccept = async (requestId: string) => {
    setBusy(requestId);
    const { error } = await supabase.rpc("accept_friend_request", { p_request_id: requestId });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Friend added 🎉");
    load(query);
  };

  const handleFollow = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("follow_user", { p_target: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    updateInPlace(id, { is_following: true });
  };

  const handleUnfollow = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("unfollow_user", { p_target: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    updateInPlace(id, { is_following: false });
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />

      <header className="relative z-10 px-5 pt-8 flex items-center gap-3">
        <Link to="/home" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Community</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Discover</span></h1>
        </div>
        <img src={iconDiscover} alt="" aria-hidden="true" loading="lazy" width={56} height={56} className="ml-auto h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--accent)/0.7)]" />
      </header>

      <main className="relative z-10 px-4 mt-4 space-y-4">
        <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex gap-2">
          <Link to="/friends" className="glass flex-1 rounded-2xl p-3 flex items-center gap-2 active:scale-95 transition-bounce">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold">My Friends</span>
          </Link>
          <Link to="/friend-requests" className="glass flex-1 rounded-2xl p-3 flex items-center gap-2 active:scale-95 transition-bounce">
            <Sparkles className="h-4 w-4 text-coin" />
            <span className="text-xs font-bold">Requests</span>
          </Link>
        </div>

        <div className="space-y-2.5">
          {fetching ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="glass h-20 animate-pulse rounded-2xl" />)
          ) : results.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              {query ? "Koi user nahi mila." : "Aas pas koi user nahi."}
            </div>
          ) : (
            results.map((u, i) => (
              <UserCard
                key={u.user_id}
                user={u}
                index={i}
                busy={busy === u.user_id}
                onAddFriend={handleAdd}
                onAcceptRequest={handleAccept}
                onCancelRequest={async (id) => {
                  // Find pending outgoing request id via search? Simpler: hit RPC by status
                  const { data } = await supabase
                    .from("friend_requests")
                    .select("id")
                    .eq("sender_id", user!.id)
                    .eq("receiver_id", id)
                    .eq("status", "pending")
                    .maybeSingle();
                  if (data?.id) {
                    await supabase.rpc("cancel_friend_request", { p_request_id: data.id });
                    updateInPlace(id, { request_outgoing: false });
                    toast.success("Request cancelled");
                  }
                }}
                onFollow={handleFollow}
                onUnfollow={handleUnfollow}
              />
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Discover;
