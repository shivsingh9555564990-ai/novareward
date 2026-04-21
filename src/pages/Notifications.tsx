import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Check, Coins, Gift, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

interface Notif {
  id: string; title: string; body: string | null; type: string;
  created_at: string; read_at: string | null; meta: any;
}

const iconFor = (type: string) => {
  if (type === "reward") return Coins;
  if (type === "redeem") return Gift;
  if (type === "rank") return Trophy;
  return Sparkles;
};

const Notifications = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at, read_at, meta")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setList((data ?? []) as Notif[]);
      setLoading(false);

      // Mark all unread as read
      const unread = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);
      if (unread.length) {
        await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
      }
    })();

    // Realtime updates
    const ch = supabase
      .channel("notif-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setList((prev) => [p.new as Notif, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />

      <header className="relative flex items-center gap-3 px-5 pt-8 pb-4">
        <Link to="/home" className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent">Inbox · 2090</p>
          <h1 className="text-2xl font-extrabold">Notifications</h1>
        </div>
        <Bell className="h-5 w-5 text-primary" />
      </header>

      <main className="relative z-10 px-5 space-y-2">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
        {!loading && list.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-bold">All caught up</p>
            <p className="text-[11px] text-muted-foreground">Earn rewards to unlock notifications</p>
          </div>
        )}
        {list.map((n) => {
          const Icon = iconFor(n.type);
          const unread = !n.read_at;
          return (
            <article key={n.id} className={cn("glass rounded-2xl p-4 flex gap-3 animate-slide-up",
              unread && "ring-1 ring-primary/40")}>
              <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
                n.type === "reward" ? "bg-coin/15 text-coin"
                  : n.type === "redeem" ? "bg-success/15 text-success"
                    : "bg-primary/15 text-primary")}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{n.title}</p>
                {n.body && <p className="text-[12px] text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {unread ? (
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow shrink-0 mt-2" />
              ) : (
                <Check className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
              )}
            </article>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
};

export default Notifications;
