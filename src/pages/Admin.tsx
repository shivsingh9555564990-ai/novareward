import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldAlert, Search, Users, Wallet, AlertTriangle, Ban, CheckCircle2,
  XCircle, IndianRupee, Coins, ChevronLeft, RefreshCw, Eye, ShieldCheck,
  ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Send, Megaphone, Activity,
  GitMerge, Bell, Trash2, Receipt, Gamepad2, Brain, Sparkles, LayoutDashboard,
  TrendingUp, UserPlus, CircleDollarSign, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────
type AdminUserRow = {
  user_id: string; email: string | null; full_name: string | null; coins: number;
  is_banned: boolean; is_suspicious: boolean; test_withdrawal_used: boolean;
  created_at: string; last_sign_in_at: string | null;
};
type Tx = {
  id: string; type: string; source: string | null; amount: number;
  status: string; reference_id: string | null; meta: any; created_at: string;
};
type RecentTx = Tx & { user_id: string; email: string | null; full_name: string | null };
type Redemption = {
  id: string; user_id: string; email: string | null; full_name: string | null;
  type: string; brand: string | null; amount_inr: number; coins_spent: number;
  upi_id: string | null; status: string; meta: any; created_at: string;
};
type ReferralRow = {
  id: string; referrer_id: string; referrer_email: string | null; referrer_name: string | null;
  referred_user_id: string; referred_email: string | null; referred_name: string | null;
  code_used: string; status: string; device_fp: string | null;
  referrer_reward: number; referred_reward: number; created_at: string; credited_at: string | null;
};
type GamePlay = {
  id: string; user_id: string; email: string | null; full_name: string | null;
  game: string; score: number; reward: number; device_fp: string | null;
  play_date: string; created_at: string;
};
type QuizAttempt = {
  id: string; user_id: string; email: string | null; full_name: string | null;
  score: number; total: number; reward: number; category: string | null; created_at: string;
};
type NotifRow = {
  id: string; user_id: string; email: string | null; full_name: string | null;
  title: string; body: string | null; type: string; read_at: string | null;
  created_at: string; meta: any;
};

type TabKey =
  | "dashboard" | "users" | "withdrawals" | "transactions"
  | "referrals" | "games" | "quiz" | "broadcast" | "notifications";

const TABS: { k: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "dashboard",     label: "Overview",      icon: LayoutDashboard },
  { k: "withdrawals",   label: "Withdrawals",   icon: Wallet },
  { k: "users",         label: "Users",         icon: Users },
  { k: "transactions",  label: "Transactions",  icon: Receipt },
  { k: "referrals",     label: "Referrals",     icon: GitMerge },
  { k: "games",         label: "Games",         icon: Gamepad2 },
  { k: "quiz",          label: "Quiz",          icon: Brain },
  { k: "broadcast",     label: "Broadcast",     icon: Megaphone },
  { k: "notifications", label: "Notifications", icon: Bell },
];

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, checked } = useIsAdmin();

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [refreshTick, setRefreshTick] = useState(0);

  // Data
  const [overview, setOverview] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userTx, setUserTx] = useState<Tx[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redStatus, setRedStatus] = useState<string>("pending");
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [gamePlays, setGamePlays] = useState<GamePlay[]>([]);
  const [quizzes, setQuizzes] = useState<QuizAttempt[]>([]);
  const [notifs, setNotifs] = useState<NotifRow[]>([]);

  // Broadcast form
  const [bTitle, setBTitle] = useState("");
  const [bBody, setBBody] = useState("");
  const [bTarget, setBTarget] = useState<"all" | "active" | "banned" | "list">("all");
  const [bUserIds, setBUserIds] = useState("");
  const [bSending, setBSending] = useState(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (checked && user && !isAdmin) {
      toast.error("Admin only area");
      navigate("/profile", { replace: true });
    }
  }, [checked, isAdmin, user, navigate]);

  const refresh = useCallback(() => setRefreshTick((x) => x + 1), []);

  // ─── Realtime: refresh dashboard counts when any of these change ────
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "redemptions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin, refresh]);

  // ─── Data loaders per tab ────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    if (tab === "dashboard") {
      supabase.rpc("admin_dashboard_overview").then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setOverview(data);
      });
    }
  }, [isAdmin, tab, refreshTick]);

  const loadUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    const { data, error } = await supabase.rpc("admin_search_users", { p_query: q, p_limit: 50 });
    setUsersLoading(false);
    if (error) { toast.error(error.message); return; }
    setUsers((data ?? []) as AdminUserRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin || tab !== "users") return;
    const t = setTimeout(() => loadUsers(search), 250);
    return () => clearTimeout(t);
  }, [isAdmin, tab, search, loadUsers, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "withdrawals") return;
    supabase.rpc("admin_list_redemptions", { p_status: redStatus, p_limit: 100 })
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setRedemptions((data ?? []) as Redemption[]);
      });
  }, [isAdmin, tab, redStatus, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "transactions") return;
    supabase.rpc("admin_recent_transactions", { p_limit: 200 }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setRecentTx((data ?? []) as RecentTx[]);
    });
  }, [isAdmin, tab, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "referrals") return;
    supabase.rpc("admin_list_referrals", { p_limit: 200 }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setReferrals((data ?? []) as ReferralRow[]);
    });
  }, [isAdmin, tab, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "games") return;
    supabase.rpc("admin_list_game_plays", { p_limit: 200 }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setGamePlays((data ?? []) as GamePlay[]);
    });
  }, [isAdmin, tab, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "quiz") return;
    supabase.rpc("admin_list_quiz_attempts", { p_limit: 200 }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setQuizzes((data ?? []) as QuizAttempt[]);
    });
  }, [isAdmin, tab, refreshTick]);

  useEffect(() => {
    if (!isAdmin || tab !== "notifications") return;
    supabase.rpc("admin_list_notifications", { p_limit: 200 }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setNotifs((data ?? []) as NotifRow[]);
    });
  }, [isAdmin, tab, refreshTick]);

  // User detail tx list
  useEffect(() => {
    if (!selectedUser) { setUserTx([]); return; }
    supabase.rpc("admin_list_user_transactions", {
      p_user_id: selectedUser.user_id, p_limit: 200,
    }).then(({ data }) => setUserTx((data ?? []) as Tx[]));
  }, [selectedUser, refreshTick]);

  // ─── ACTIONS ───────────────────────
  const ban = async (u: AdminUserRow, banned: boolean) => {
    let reason: string | null = null;
    if (banned) reason = window.prompt("Ban reason (shown to user):") || "Account flagged";
    const { error } = await supabase.rpc("admin_set_ban", { p_user_id: u.user_id, p_banned: banned, p_reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success(banned ? "User banned" : "User unbanned");
    if (selectedUser?.user_id === u.user_id) setSelectedUser({ ...u, is_banned: banned, ban_reason: reason } as any);
    refresh();
  };

  const flagSus = async (u: AdminUserRow, flag: boolean) => {
    const { error } = await supabase.rpc("admin_set_suspicious", { p_user_id: u.user_id, p_flag: flag });
    if (error) { toast.error(error.message); return; }
    toast.success(flag ? "Marked suspicious" : "Cleared flag");
    if (selectedUser?.user_id === u.user_id) setSelectedUser({ ...u, is_suspicious: flag });
    refresh();
  };

  const adjust = async (u: AdminUserRow, sign: 1 | -1) => {
    const raw = window.prompt(`${sign > 0 ? "Credit" : "Debit"} how many NC?`);
    if (!raw) return;
    const amt = Math.abs(parseInt(raw, 10));
    if (!amt || isNaN(amt)) { toast.error("Invalid amount"); return; }
    const note = window.prompt("Note (optional):") || null;
    const { data, error } = await supabase.rpc("admin_adjust_coins", {
      p_user_id: u.user_id, p_amount: sign * amt, p_note: note,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`${sign > 0 ? "Credited" : "Debited"} ${amt} NC`);
    if (selectedUser?.user_id === u.user_id) {
      setSelectedUser({ ...u, coins: u.coins + sign * amt });
    }
    refresh();
  };

  const setBalance = async (u: AdminUserRow) => {
    const raw = window.prompt(`Set new coin balance (current: ${u.coins})`);
    if (!raw) return;
    const target = parseInt(raw, 10);
    if (isNaN(target) || target < 0) { toast.error("Invalid balance"); return; }
    const note = window.prompt("Note (optional):") || null;
    const { data, error } = await supabase.rpc("admin_set_user_coins", {
      p_user_id: u.user_id, p_target_balance: target, p_note: note,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`Balance set to ${target} NC`);
    if (selectedUser?.user_id === u.user_id) setSelectedUser({ ...u, coins: target });
    refresh();
  };

  const reverseTx = async (tx: Tx) => {
    if (tx.amount <= 0) { toast.error("Only positive credits can be reversed"); return; }
    if (tx.status === "reversed") { toast.error("Already reversed"); return; }
    const reason = window.prompt("Reason for rejection:") || "Admin review";
    const { data, error } = await supabase.rpc("admin_reverse_transaction", {
      p_tx_id: tx.id, p_reason: reason,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success("Transaction reversed, coins deducted");
    refresh();
  };

  const updateRedemption = async (r: Redemption, action: "approve" | "reject" | "paid" | "unpaid") => {
    let utr: string | null = null;
    let note: string | null = null;
    if (action === "paid") {
      utr = window.prompt("UTR / Payment reference:") || null;
      if (!utr) { toast.error("UTR required"); return; }
    }
    if (action === "reject") {
      note = window.prompt("Reject reason:") || "Rejected by admin";
    }
    const { data, error } = await supabase.rpc("admin_update_redemption", {
      p_redemption_id: r.id, p_action: action, p_utr: utr, p_note: note,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`Marked ${action}`);
    refresh();
  };

  const sendBroadcast = async () => {
    if (!bTitle.trim()) { toast.error("Title required"); return; }
    setBSending(true);
    const ids = bTarget === "list"
      ? bUserIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
      : null;
    const { data, error } = await supabase.rpc("admin_broadcast_notification", {
      p_title: bTitle, p_body: bBody || null, p_target: bTarget,
      p_user_ids: ids, p_type: "system",
    });
    setBSending(false);
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`📣 Sent to ${res.sent} users`);
    setBTitle(""); setBBody(""); setBUserIds("");
  };

  const deleteNotif = async (id: string) => {
    if (!window.confirm("Delete this notification?")) return;
    const { data, error } = await supabase.rpc("admin_delete_notification", { p_notification_id: id });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error("Not found"); return; }
    toast.success("Deleted");
    refresh();
  };

  if (authLoading || !checked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) return null;

  // ─── USER DETAIL VIEW ───────────────────
  if (selectedUser) {
    return (
      <div className="relative min-h-screen pb-12">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40 px-4 py-3 flex items-center gap-2">
          <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
            <p className="font-bold truncate">{selectedUser.full_name || "(no name)"}</p>
          </div>
          <button onClick={refresh} className="p-2"><RefreshCw className="h-4 w-4" /></button>
        </header>

        <main className="px-4 pt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedUser.is_banned && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Banned</Badge>}
            {selectedUser.is_suspicious && <Badge className="bg-coin text-background"><AlertTriangle className="h-3 w-3 mr-1" />Suspicious</Badge>}
            {selectedUser.test_withdrawal_used && <Badge variant="outline">₹2 test used</Badge>}
            {!selectedUser.is_banned && !selectedUser.is_suspicious && <Badge className="bg-success/20 text-success"><BadgeCheck className="h-3 w-3 mr-1" />Clean</Badge>}
          </div>

          <div className="glass rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current balance</p>
              <p className="text-3xl font-extrabold text-coin tabular-nums">{selectedUser.coins.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">≈ ₹{(selectedUser.coins / 12).toFixed(2)}</p>
            </div>
            <Coins className="h-10 w-10 text-coin/40" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => adjust(selectedUser, 1)}>
              <ArrowDownToLine className="h-4 w-4 mr-1" /> Credit
            </Button>
            <Button variant="outline" onClick={() => adjust(selectedUser, -1)}>
              <ArrowUpFromLine className="h-4 w-4 mr-1" /> Debit
            </Button>
            <Button variant="outline" onClick={() => setBalance(selectedUser)} className="col-span-2">
              <CircleDollarSign className="h-4 w-4 mr-1" /> Set exact balance
            </Button>
            <Button variant={selectedUser.is_banned ? "default" : "destructive"} onClick={() => ban(selectedUser, !selectedUser.is_banned)}>
              {selectedUser.is_banned ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              {selectedUser.is_banned ? "Unban" : "Ban"}
            </Button>
            <Button variant={selectedUser.is_suspicious ? "default" : "outline"} onClick={() => flagSus(selectedUser, !selectedUser.is_suspicious)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              {selectedUser.is_suspicious ? "Clear flag" : "Suspicious"}
            </Button>
            <Button variant="outline" className="col-span-2" onClick={() => {
              setBTarget("list"); setBUserIds(selectedUser.user_id); setSelectedUser(null); setTab("broadcast");
            }}>
              <Send className="h-4 w-4 mr-1" /> Send notification to user
            </Button>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Transactions ({userTx.length})
            </h2>
            <div className="space-y-2">
              {userTx.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No transactions</p>
              )}
              {userTx.map((tx) => {
                const isCredit = tx.amount > 0;
                const reversed = tx.status === "reversed";
                return (
                  <div key={tx.id} className={cn("glass rounded-xl p-3 flex items-center gap-3", reversed && "opacity-60")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{tx.type} · {tx.source || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {new Date(tx.created_at).toLocaleString()} · {tx.status}
                      </p>
                    </div>
                    <p className={cn("text-sm font-bold tabular-nums", isCredit ? "text-success" : "text-destructive")}>
                      {isCredit ? "+" : ""}{tx.amount}
                    </p>
                    {isCredit && !reversed && (
                      <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => reverseTx(tx)}>Reject</Button>
                    )}
                    {reversed && <Badge variant="outline" className="text-[10px]">Reversed</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── MAIN ADMIN VIEW ───────────────────
  return (
    <div className="relative min-h-screen pb-12">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate("/profile")} className="p-2 -ml-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-extrabold flex-1">Admin Control</h1>
        <button onClick={refresh} className="p-2"><RefreshCw className="h-4 w-4" /></button>
      </header>

      {/* Horizontal scrolling tabs */}
      <div className="px-3 pt-3">
        <div className="glass rounded-2xl p-1 flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-smooth",
                tab === t.k
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4 space-y-3">
        {/* ─── DASHBOARD ─── */}
        {tab === "dashboard" && (
          <>
            {!overview && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}
            {overview && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Users total" value={overview.users_total} icon={<Users className="h-5 w-5 text-primary" />} accent />
                  <StatCard label="Today signups" value={overview.users_today} icon={<UserPlus className="h-5 w-5 text-success" />} />
                  <StatCard label="Banned" value={overview.users_banned} icon={<Ban className="h-5 w-5 text-destructive" />} />
                  <StatCard label="Suspicious" value={overview.users_suspicious} icon={<AlertTriangle className="h-5 w-5 text-coin" />} />
                </div>

                <div className="glass rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Withdrawals</p>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Pending" value={overview.pending_redemptions} sub={`₹${overview.pending_inr}`} />
                    <MiniStat label="Paid today" value={`₹${overview.paid_today_inr}`} sub={`₹${overview.paid_total_inr} total`} />
                  </div>
                </div>

                <div className="glass rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coin economy</p>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Earned today" value={overview.coins_earned_today} />
                    <MiniStat label="Spent today" value={overview.coins_spent_today} />
                    <MiniStat label="In circulation" value={overview.coins_in_circulation} />
                  </div>
                </div>

                <div className="glass rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Activity today</p>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Tx" value={overview.transactions_today} />
                    <MiniStat label="Games" value={overview.game_plays_today} />
                    <MiniStat label="Quiz" value={overview.quiz_today} />
                  </div>
                </div>

                <div className="glass rounded-2xl p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Referrals</p>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Total" value={overview.referrals_total} />
                    <MiniStat label="Credited" value={overview.referrals_credited} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button variant="outline" onClick={() => setTab("withdrawals")}>
                    <Wallet className="h-4 w-4 mr-1" /> Withdrawals
                  </Button>
                  <Button variant="outline" onClick={() => setTab("broadcast")}>
                    <Megaphone className="h-4 w-4 mr-1" /> Broadcast
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── USERS ─── */}
        {tab === "users" && (
          <>
            <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            {usersLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => setSelectedUser(u)}
                  className="w-full glass rounded-xl p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-bounce"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {(u.full_name || u.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{u.full_name || "(no name)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <div className="flex gap-1 mt-1">
                      {u.is_banned && <Badge variant="destructive" className="text-[9px] py-0 h-4">Banned</Badge>}
                      {u.is_suspicious && <Badge className="bg-coin text-background text-[9px] py-0 h-4">Suspicious</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-coin tabular-nums">{u.coins.toLocaleString()}</p>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground ml-auto mt-1" />
                  </div>
                </button>
              ))}
              {users.length === 0 && !usersLoading && (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              )}
            </div>
          </>
        )}

        {/* ─── WITHDRAWALS ─── */}
        {tab === "withdrawals" && (
          <>
            <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
              {["pending", "approved", "paid", "rejected", ""].map((s) => (
                <button
                  key={s || "all"}
                  onClick={() => setRedStatus(s)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-smooth border",
                    redStatus === s
                      ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                      : "border-primary/20 bg-muted/40 text-muted-foreground"
                  )}
                >
                  {s ? s[0].toUpperCase() + s.slice(1) : "All"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {redemptions.map((r) => {
                const isTest = r.meta?.test_withdrawal === true;
                return (
                  <div key={r.id} className="glass rounded-2xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">
                          ₹{r.amount_inr} · {r.type === "upi" ? r.upi_id : r.brand}
                          {isTest && <Badge variant="outline" className="ml-2 text-[9px]">TEST</Badge>}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()} · {r.coins_spent} NC
                        </p>
                        {r.meta?.utr && (
                          <p className="text-[10px] text-success font-mono">UTR: {r.meta.utr}</p>
                        )}
                      </div>
                      <Badge variant={
                        r.status === "paid" ? "default" :
                        r.status === "rejected" ? "destructive" :
                        r.status === "approved" ? "secondary" : "outline"
                      } className="text-[10px]">{r.status}</Badge>
                    </div>
                    {(r.status === "pending" || r.status === "approved") && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => updateRedemption(r, "approve")}>
                            Approve
                          </Button>
                        )}
                        <Button size="sm" className="h-8 bg-success text-success-foreground hover:bg-success/90" onClick={() => updateRedemption(r, "paid")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8" onClick={() => updateRedemption(r, "reject")}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                    {r.status === "paid" && (
                      <Button size="sm" variant="outline" className="h-8 w-full" onClick={() => updateRedemption(r, "unpaid")}>
                        Mark unpaid
                      </Button>
                    )}
                  </div>
                );
              })}
              {redemptions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No {redStatus || "any"} withdrawals</p>
              )}
            </div>
          </>
        )}

        {/* ─── TRANSACTIONS (all users) ─── */}
        {tab === "transactions" && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
              Latest 200 transactions across all users
            </p>
            {recentTx.map((tx) => {
              const isCredit = tx.amount > 0;
              const reversed = tx.status === "reversed";
              return (
                <div key={tx.id} className={cn("glass rounded-xl p-3 flex items-center gap-3", reversed && "opacity-60")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{tx.type} · {tx.source || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{tx.email || "?"} · {tx.full_name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString()} · {tx.status}</p>
                  </div>
                  <p className={cn("text-sm font-bold tabular-nums", isCredit ? "text-success" : "text-destructive")}>
                    {isCredit ? "+" : ""}{tx.amount}
                  </p>
                  {isCredit && !reversed && (
                    <Button size="sm" variant="destructive" className="h-8 px-2" onClick={() => reverseTx(tx)}>
                      Reject
                    </Button>
                  )}
                  {reversed && <Badge variant="outline" className="text-[10px]">Reversed</Badge>}
                </div>
              );
            })}
            {recentTx.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No transactions</p>}
          </div>
        )}

        {/* ─── REFERRALS ─── */}
        {tab === "referrals" && (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="glass rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold truncate">
                    Code <span className="text-primary">{r.code_used}</span>
                  </p>
                  <Badge variant={r.status === "credited" ? "default" : "outline"} className="text-[10px]">
                    {r.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  By: {r.referrer_email || r.referrer_id} → {r.referred_email || r.referred_user_id}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · +{r.referrer_reward}/+{r.referred_reward} NC
                </p>
                {r.device_fp && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate">fp: {r.device_fp.slice(0, 24)}…</p>
                )}
              </div>
            ))}
            {referrals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No referrals</p>}
          </div>
        )}

        {/* ─── GAMES ─── */}
        {tab === "games" && (
          <div className="space-y-2">
            {gamePlays.map((g) => (
              <div key={g.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <Gamepad2 className="h-5 w-5 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{g.game} · score {g.score}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{g.email || "?"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(g.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold text-coin tabular-nums">+{g.reward}</p>
              </div>
            ))}
            {gamePlays.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No game plays</p>}
          </div>
        )}

        {/* ─── QUIZ ─── */}
        {tab === "quiz" && (
          <div className="space-y-2">
            {quizzes.map((q) => (
              <div key={q.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {q.score}/{q.total} · {q.category || "Mixed"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{q.email || "?"}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(q.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold text-coin tabular-nums">+{q.reward}</p>
              </div>
            ))}
            {quizzes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No quiz attempts</p>}
          </div>
        )}

        {/* ─── BROADCAST ─── */}
        {tab === "broadcast" && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Send notification</p>
              <input
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="Title (e.g., 🎉 New offer live!)"
                className="w-full bg-muted/40 rounded-xl px-3 py-2.5 text-sm outline-none border border-border/50 focus:border-primary"
              />
              <textarea
                value={bBody}
                onChange={(e) => setBBody(e.target.value)}
                placeholder="Message body (optional)"
                rows={3}
                className="w-full bg-muted/40 rounded-xl px-3 py-2.5 text-sm outline-none border border-border/50 focus:border-primary resize-none"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {(["all", "active", "banned", "list"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBTarget(opt)}
                    className={cn(
                      "rounded-xl py-2 text-xs font-bold capitalize transition-smooth",
                      bTarget === opt
                        ? "bg-gradient-primary text-primary-foreground shadow-glow"
                        : "bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {bTarget === "list" && (
                <textarea
                  value={bUserIds}
                  onChange={(e) => setBUserIds(e.target.value)}
                  placeholder="User IDs (comma or newline separated)"
                  rows={3}
                  className="w-full bg-muted/40 rounded-xl px-3 py-2.5 text-xs font-mono outline-none border border-border/50 focus:border-primary resize-none"
                />
              )}
              <Button onClick={sendBroadcast} disabled={bSending} className="w-full" variant="hero">
                <Send className="h-4 w-4 mr-1" />
                {bSending ? "Sending…" : "Broadcast"}
              </Button>
            </div>
            <div className="glass rounded-xl p-3 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Tip: Set "list" to send to specific user IDs (from Users tab).</p>
            </div>
          </div>
        )}

        {/* ─── NOTIFICATIONS (moderate) ─── */}
        {tab === "notifications" && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
              Latest notifications across all users
            </p>
            {notifs.map((n) => (
              <div key={n.id} className="glass rounded-xl p-3 flex items-start gap-2">
                <Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground truncate">
                    {n.email || "?"} · {n.type} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteNotif(n.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {notifs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>}
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) => (
  <div className={cn("glass rounded-2xl p-3", accent && "neon-border")}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-extrabold tabular-nums mt-1">
      {typeof value === "number" ? (value ?? 0).toLocaleString() : value ?? 0}
    </p>
  </div>
);

const MiniStat = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => (
  <div className="bg-muted/30 rounded-xl p-2">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-base font-extrabold tabular-nums">
      {typeof value === "number" ? (value ?? 0).toLocaleString() : value ?? 0}
    </p>
    {sub && <p className="text-[9px] text-muted-foreground truncate">{sub}</p>}
  </div>
);

export default Admin;
