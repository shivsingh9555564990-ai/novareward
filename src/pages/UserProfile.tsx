import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trophy, Coins, Users, UserPlus, UserCheck, UserMinus, Clock, Check, X, Sparkles, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Avatar } from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProfileResp = {
  success: boolean;
  is_self: boolean;
  profile: {
    id: string; name: string; avatar_url: string | null;
    coins: number; friends_count: number;
    followers_count: number; following_count: number;
    bio: string | null; created_at: string; rank: number | null;
  };
  relationship: {
    is_friend: boolean; is_following: boolean;
    request_outgoing: boolean; request_incoming: boolean;
    incoming_request_id: string | null;
  };
};

const tier = (coins: number) => {
  if (coins >= 10000) return { name: "Diamond", color: "from-accent to-primary", icon: "💎" };
  if (coins >= 5000) return { name: "Platinum", color: "from-secondary to-accent", icon: "🏆" };
  if (coins >= 1000) return { name: "Gold", color: "from-coin to-secondary", icon: "🥇" };
  if (coins >= 250) return { name: "Silver", color: "from-muted-foreground to-muted", icon: "🥈" };
  return { name: "Bronze", color: "from-muted to-muted-foreground", icon: "🥉" };
};

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [data, setData] = useState<ProfileResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<{ amount: number; created_at: string; source: string | null }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!id) return;
    const { data: resp, error } = await supabase.rpc("get_user_profile", { p_user_id: id });
    if (error) { toast.error(error.message); return; }
    const r = resp as unknown as ProfileResp;
    if (!r?.success) { toast.error("User not found"); navigate(-1); return; }
    setData(r);
    if (r.is_self) {
      // Show own recent earnings only (RLS restricts others)
      const { data: tx } = await supabase
        .from("transactions").select("amount, created_at, source")
        .eq("user_id", id).order("created_at", { ascending: false }).limit(5);
      setRecent(tx ?? []);
    } else {
      setRecent([]);
    }
  };

  useEffect(() => { if (user && id) load(); }, [user, id]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass h-32 w-64 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const p = data.profile;
  const rel = data.relationship;
  const t = tier(p.coins);

  const action = async (rpc: string, args: Record<string, unknown>, msg: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(rpc as any, args as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    load();
  };

  // ===== Activity graph (placeholder bars based on coins distribution) =====
  const bars = Array.from({ length: 7 }).map((_, i) => 20 + ((p.coins + i * 7) % 80));

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className={cn("pointer-events-none absolute -top-20 right-1/2 translate-x-1/2 h-72 w-72 rounded-full blur-3xl bg-gradient-to-br opacity-50", t.color)} />

      <header className="relative z-10 px-5 pt-8 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></button>
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Profile</p>
      </header>

      <main className="relative z-10 px-4 mt-4 space-y-4">
        {/* Hero card */}
        <div className="glass relative overflow-hidden rounded-3xl p-6 text-center">
          <div className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b opacity-20", t.color)} />
          <div className="relative">
            <Avatar name={p.name} src={p.avatar_url} size="h-20 w-20 text-3xl mx-auto" />
            <h1 className="mt-3 text-xl font-extrabold">{p.name}</h1>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-coin/40 bg-coin/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-coin">
              <span>{t.icon}</span> {t.name} Tier
            </div>
            {p.bio && <p className="mt-3 text-xs text-muted-foreground max-w-xs mx-auto">{p.bio}</p>}
            <p className="mt-2 text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-2xl p-3 text-center">
            <Coins className="h-4 w-4 mx-auto text-coin" />
            <p className="mt-1 text-lg font-extrabold text-gradient-coin">{p.coins.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Coins</p>
          </div>
          <div className="glass rounded-2xl p-3 text-center">
            <Trophy className="h-4 w-4 mx-auto text-accent" />
            <p className="mt-1 text-lg font-extrabold">{p.rank ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Rank</p>
          </div>
          <div className="glass rounded-2xl p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-primary" />
            <p className="mt-1 text-lg font-extrabold">{p.friends_count}</p>
            <p className="text-[10px] text-muted-foreground">Friends</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-2xl p-3 text-center">
            <p className="text-lg font-extrabold">{p.followers_count}</p>
            <p className="text-[10px] text-muted-foreground">Followers</p>
          </div>
          <div className="glass rounded-2xl p-3 text-center">
            <p className="text-lg font-extrabold">{p.following_count}</p>
            <p className="text-[10px] text-muted-foreground">Following</p>
          </div>
        </div>

        {/* CTAs */}
        {!data.is_self && (
          <div className="flex gap-2">
            {rel.is_friend ? (
              <Button variant="outline" className="flex-1 gap-1.5" disabled={busy}
                onClick={() => confirm(`Remove ${p.name}?`) && action("remove_friend", { p_other: p.id }, "Friend removed")}>
                <UserMinus className="h-4 w-4" /> Remove Friend
              </Button>
            ) : rel.request_incoming && rel.incoming_request_id ? (
              <>
                <Button variant="hero" className="flex-1 gap-1.5" disabled={busy}
                  onClick={() => action("accept_friend_request", { p_request_id: rel.incoming_request_id }, "Friend added 🎉")}>
                  <Check className="h-4 w-4" /> Accept
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" disabled={busy}
                  onClick={() => action("decline_friend_request", { p_request_id: rel.incoming_request_id }, "Declined")}>
                  <X className="h-4 w-4" /> Decline
                </Button>
              </>
            ) : rel.request_outgoing ? (
              <Button variant="outline" className="flex-1 gap-1.5" disabled={busy}>
                <Clock className="h-4 w-4" /> Request Sent
              </Button>
            ) : (
              <Button variant="hero" className="flex-1 gap-1.5" disabled={busy}
                onClick={() => action("send_friend_request", { p_receiver: p.id }, "Friend request sent")}>
                <UserPlus className="h-4 w-4" /> Add Friend
              </Button>
            )}
            <Button
              variant={rel.is_following ? "outline" : "secondary"}
              className="flex-1"
              disabled={busy}
              onClick={() => action(rel.is_following ? "unfollow_user" : "follow_user", { p_target: p.id },
                rel.is_following ? "Unfollowed" : "Following")}
            >
              {rel.is_following ? <><UserCheck className="h-4 w-4 mr-1.5" />Following</> : "Follow"}
            </Button>
          </div>
        )}

        {/* Activity graph */}
        <div className="glass rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Activity</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end justify-between h-24 gap-1.5">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-accent shadow-glow"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[9px] text-muted-foreground">{["S","M","T","W","T","F","S"][i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent earnings (own only) */}
        {data.is_self && recent.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground px-1">Recent Earnings</h3>
            {recent.map((tx, i) => (
              <div key={i} className="glass rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold capitalize">{tx.source ?? "Reward"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <span className={cn("text-sm font-extrabold", tx.amount > 0 ? "text-success" : "text-destructive")}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} NC
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default UserProfile;
