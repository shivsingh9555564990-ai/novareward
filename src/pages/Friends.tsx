import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, UserMinus, Users, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { Avatar } from "@/components/UserCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import iconFriends from "@/assets/icon-friends.png";
import { cn } from "@/lib/utils";

type Friend = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  coins: number;
  friends_since: string;
};

const Friends = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc("list_friends", { p_limit: 200 });
    if (error) toast.error(error.message);
    setFriends((data ?? []) as Friend[]);
    setFetching(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from friends?`)) return;
    setBusy(id);
    const { error } = await supabase.rpc("remove_friend", { p_other: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    setFriends((fs) => fs.filter((f) => f.user_id !== id));
    toast.success("Friend removed");
  };

  // Visual "active" badge: friends_since within last 7 days = active
  const isRecent = (iso: string) => Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;

  const visible = friends.filter((f) =>
    !query.trim() || f.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />

      <header className="relative z-10 px-5 pt-8 flex items-center gap-3">
        <Link to="/home" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Community</p>
          <h1 className="text-2xl font-extrabold"><span className="text-gradient-neon">Friends</span></h1>
        </div>
        <img src={iconFriends} alt="" aria-hidden="true" loading="lazy" width={56} height={56} className="ml-auto h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.7)]" />
      </header>

      <main className="relative z-10 px-4 mt-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-2xl p-3 text-center">
            <Users className="h-4 w-4 mx-auto text-primary" />
            <p className="mt-1 text-lg font-extrabold">{friends.length}</p>
            <p className="text-[10px] text-muted-foreground">Friends</p>
          </div>
          <Link to="/friend-requests" className="glass rounded-2xl p-3 text-center active:scale-95">
            <p className="text-2xl">📨</p>
            <p className="text-[10px] text-muted-foreground mt-1">Requests</p>
          </Link>
          <Link to="/discover" className="glass rounded-2xl p-3 text-center active:scale-95">
            <p className="text-2xl">🔍</p>
            <p className="text-[10px] text-muted-foreground mt-1">Discover</p>
          </Link>
        </div>

        <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2.5">
          {fetching ? (
            [0, 1, 2].map((i) => <div key={i} className="glass h-20 animate-pulse rounded-2xl" />)
          ) : visible.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground space-y-3">
              <p>{query ? "Koi match nahi." : "Abhi koi friends nahi. Discover karein!"}</p>
              {!query && (
                <Link to="/discover">
                  <Button variant="hero" size="sm">Find Friends</Button>
                </Link>
              )}
            </div>
          ) : (
            visible.map((f, i) => {
              const active = isRecent(f.friends_since);
              return (
                <div
                  key={f.user_id}
                  className="glass relative flex items-center gap-3 rounded-2xl p-3 animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Link to={`/u/${f.user_id}`} className="flex flex-1 items-center gap-3 min-w-0">
                    <div className="relative">
                      <Avatar name={f.name} src={f.avatar_url} />
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
                        active ? "bg-success animate-pulse" : "bg-muted-foreground/50"
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{f.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-coin" />{f.coins.toLocaleString()}</span>
                        <span>· {active ? "Active" : "Away"}</span>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(f.user_id, f.name)}
                    disabled={busy === f.user_id}
                    className="rounded-full bg-destructive/10 p-2 text-destructive active:scale-95 disabled:opacity-50"
                    aria-label={`Remove ${f.name}`}
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Friends;
