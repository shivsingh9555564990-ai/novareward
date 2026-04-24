import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, BellOff, CheckCheck, Coins, Gift, Sparkles, Trash2, Trophy, Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  type: string;
  created_at: string;
  read_at: string | null;
  meta: any;
}

const iconFor = (type: string) => {
  if (type === "reward") return Coins;
  if (type === "redeem") return Gift;
  if (type === "rank") return Trophy;
  if (type === "social") return Users;
  if (type === "system") return Bell;
  return Sparkles;
};

const tintFor = (type: string) => {
  if (type === "reward") return "text-coin bg-coin/15";
  if (type === "redeem") return "text-secondary bg-secondary/15";
  if (type === "rank") return "text-coin bg-coin/15";
  if (type === "social") return "text-accent bg-accent/15";
  return "text-primary bg-primary/15";
};

const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const groupKey = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  if (Date.now() - d.getTime() < 7 * 86400000) return "This week";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [list, setList] = useState<Notif[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [user, loading, navigate]);

  const refresh = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setBusy(false);
    setList((data ?? []) as Notif[]);
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifs:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const visible = useMemo(
    () => (filter === "all" ? list : list.filter((n) => !n.read_at)),
    [list, filter]
  );

  const unreadCount = list.filter((n) => !n.read_at).length;

  const markRead = async (id: string) => {
    setList((cur) => cur.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  const markAll = async () => {
    if (unreadCount === 0) return;
    setList((cur) => cur.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) toast.error(error.message);
    else toast.success("All marked as read");
  };

  const remove = async (id: string) => {
    const prev = list;
    setList((cur) => cur.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setList(prev);
      toast.error("Delete failed");
    }
  };

  const onTap = async (n: Notif) => {
    if (!n.read_at) await markRead(n.id);
    if (n.type === "reward") navigate("/wallet");
    else if (n.type === "redeem") navigate("/my-redemptions");
    else if (n.type === "rank") navigate("/leaderboard");
    else if (n.type === "social") navigate("/friend-requests");
  };

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, Notif[]>();
    for (const n of visible) {
      const k = groupKey(n.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(n);
    }
    return Array.from(map.entries());
  }, [visible]);

  if (loading || !user) return null;

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative z-10 px-5 pt-10 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-xl glass flex items-center justify-center"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Inbox</p>
          <h1 className="text-2xl font-extrabold leading-tight">
            Notifications {unreadCount > 0 && <span className="text-primary">({unreadCount})</span>}
          </h1>
        </div>
        {list.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} disabled={unreadCount === 0}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all
          </Button>
        )}
      </header>

      <div className="relative z-10 px-5 mb-3 flex gap-2">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground"
            )}
          >
            {f === "all" ? "All" : `Unread${unreadCount ? ` · ${unreadCount}` : ""}`}
          </button>
        ))}
      </div>

      <main className="relative z-10 px-5 space-y-5">
        {busy && list.length === 0 && (
          <Card className="glass p-8 text-center text-sm text-muted-foreground">
            Loading…
          </Card>
        )}

        {!busy && visible.length === 0 && (
          <Card className="glass p-10 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-bold text-sm">
              {filter === "unread" ? "All caught up 🎉" : "No notifications yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You'll see reward, friend, and system updates here
            </p>
          </Card>
        )}

        {grouped.map(([label, items]) => (
          <section key={label}>
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 mb-2">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map((n) => {
                const Icon = iconFor(n.type);
                const tint = tintFor(n.type);
                const unread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "glass rounded-2xl p-3 flex items-start gap-3 active:scale-[0.99] transition-bounce",
                      unread && "ring-1 ring-primary/40"
                    )}
                  >
                    <button
                      onClick={() => onTap(n)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", tint)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold leading-tight truncate">{n.title}</p>
                          {unread && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => remove(n.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive flex-shrink-0"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <BottomNav />
    </div>
  );
};

export default Notifications;
