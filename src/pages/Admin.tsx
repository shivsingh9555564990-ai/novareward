import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Users, Wallet, AlertTriangle, Ban, CheckCircle2,
  XCircle, Coins, ChevronLeft, RefreshCw, Eye, ShieldCheck,
  ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Send, Megaphone,
  GitMerge, Bell, Trash2, Receipt, Gamepad2, Brain, Sparkles, LayoutDashboard,
  UserPlus, CircleDollarSign, ChevronRight, ChevronLeft as ChevLeft,
  CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────
type AdminUserRow = {
  user_id: string; email: string | null; full_name: string | null; coins: number;
  is_banned: boolean; is_suspicious: boolean; test_withdrawal_used: boolean;
  created_at: string; last_sign_in_at: string | null; total_count?: number;
};
type Tx = {
  id: string; type: string; source: string | null; amount: number;
  status: string; reference_id: string | null; meta: any; created_at: string;
};
type RecentTx = Tx & { user_id: string; email: string | null; full_name: string | null; total_count?: number };
type Redemption = {
  id: string; user_id: string; email: string | null; full_name: string | null;
  type: string; brand: string | null; amount_inr: number; coins_spent: number;
  upi_id: string | null; status: string; meta: any; created_at: string; total_count?: number;
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

const PAGE_SIZE = 25;

// Brand palette (green / white / orange) — scoped to admin shell only via inline styles
const BRAND = {
  bg: "#0b1410",            // very dark green/black
  card: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.08)",
  ink: "#ffffff",
  inkMuted: "rgba(255,255,255,0.62)",
  green: "#22c55e",         // emerald
  greenSoft: "rgba(34,197,94,0.16)",
  orange: "#f97316",        // tangerine
  orangeSoft: "rgba(249,115,22,0.18)",
  red: "#ef4444",
  white: "#ffffff",
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, checked } = useIsAdmin();

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [refreshTick, setRefreshTick] = useState(0);

  // Data
  const [overview, setOverview] = useState<any>(null);

  // Users
  const [search, setSearch] = useState("");
  const [usersPage, setUsersPage] = useState(0);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userTx, setUserTx] = useState<Tx[]>([]);

  // Withdrawals
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redStatus, setRedStatus] = useState<string>("pending");
  const [redPage, setRedPage] = useState(0);
  const [redTotal, setRedTotal] = useState(0);

  // Transactions
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [txType, setTxType] = useState<string>("");
  const [txPage, setTxPage] = useState(0);
  const [txTotal, setTxTotal] = useState(0);

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

  // Realtime: refresh dashboard counts when any of these change
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

  // ─── Loaders ──────────────────────
  useEffect(() => {
    if (!isAdmin || tab !== "dashboard") return;
    supabase.rpc("admin_dashboard_overview").then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      setOverview(data);
    });
  }, [isAdmin, tab, refreshTick]);

  const loadUsers = useCallback(async (q: string, page: number) => {
    setUsersLoading(true);
    const { data, error } = await supabase.rpc("admin_search_users", {
      p_query: q, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
    });
    setUsersLoading(false);
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []) as AdminUserRow[];
    setUsers(rows);
    setUsersTotal(rows[0]?.total_count ?? 0);
  }, []);

  // Reset to page 0 when search changes
  useEffect(() => { setUsersPage(0); }, [search]);

  useEffect(() => {
    if (!isAdmin || tab !== "users") return;
    const t = setTimeout(() => loadUsers(search, usersPage), 250);
    return () => clearTimeout(t);
  }, [isAdmin, tab, search, usersPage, loadUsers, refreshTick]);

  useEffect(() => { setRedPage(0); }, [redStatus]);
  useEffect(() => {
    if (!isAdmin || tab !== "withdrawals") return;
    supabase.rpc("admin_list_redemptions", {
      p_status: redStatus, p_limit: PAGE_SIZE, p_offset: redPage * PAGE_SIZE,
    }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      const rows = (data ?? []) as Redemption[];
      setRedemptions(rows);
      setRedTotal(rows[0]?.total_count ?? 0);
    });
  }, [isAdmin, tab, redStatus, redPage, refreshTick]);

  useEffect(() => { setTxPage(0); }, [txType]);
  useEffect(() => {
    if (!isAdmin || tab !== "transactions") return;
    supabase.rpc("admin_recent_transactions", {
      p_limit: PAGE_SIZE, p_offset: txPage * PAGE_SIZE, p_type: txType || null,
    }).then(({ data, error }) => {
      if (error) { toast.error(error.message); return; }
      const rows = (data ?? []) as RecentTx[];
      setRecentTx(rows);
      setTxTotal(rows[0]?.total_count ?? 0);
    });
  }, [isAdmin, tab, txType, txPage, refreshTick]);

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

  useEffect(() => {
    if (!selectedUser) { setUserTx([]); return; }
    supabase.rpc("admin_list_user_transactions", {
      p_user_id: selectedUser.user_id, p_limit: 200,
    }).then(({ data }) => setUserTx((data ?? []) as Tx[]));
  }, [selectedUser, refreshTick]);

  // ─── ACTIONS ──────────────────────
  const ban = async (u: AdminUserRow, banned: boolean) => {
    let reason: string | null = null;
    if (banned) reason = window.prompt("Ban reason (shown to user):") || "Account flagged";
    const { error } = await supabase.rpc("admin_set_ban", { p_user_id: u.user_id, p_banned: banned, p_reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success(banned ? "User banned" : "User unbanned");
    if (selectedUser?.user_id === u.user_id) setSelectedUser({ ...u, is_banned: banned });
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

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllOnPage = () => {
    const allOn = users.every((u) => selectedIds.has(u.user_id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOn) users.forEach((u) => next.delete(u.user_id));
      else users.forEach((u) => next.add(u.user_id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const bulkBan = async (banned: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let reason: string | null = null;
    if (banned) reason = window.prompt(`Ban ${ids.length} users — reason:`) || "Bulk action";
    if (!window.confirm(`${banned ? "Ban" : "Unban"} ${ids.length} users?`)) return;
    const { data, error } = await supabase.rpc("admin_bulk_set_ban", {
      p_user_ids: ids, p_banned: banned, p_reason: reason,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`${banned ? "Banned" : "Unbanned"} ${res.updated} users`);
    clearSelection();
    refresh();
  };

  const bulkAdjust = async (sign: 1 | -1) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const raw = window.prompt(`${sign > 0 ? "Credit" : "Debit"} how many NC to each of ${ids.length} users?`);
    if (!raw) return;
    const amt = Math.abs(parseInt(raw, 10));
    if (!amt || isNaN(amt)) { toast.error("Invalid amount"); return; }
    const note = window.prompt("Note (optional):") || null;
    const { data, error } = await supabase.rpc("admin_bulk_adjust_coins", {
      p_user_ids: ids, p_amount: sign * amt, p_note: note,
    });
    if (error) { toast.error(error.message); return; }
    const res = data as any;
    if (!res?.success) { toast.error(res?.error || "Failed"); return; }
    toast.success(`${sign > 0 ? "Credited" : "Debited"} ${amt} NC × ${res.updated}`);
    clearSelection();
    refresh();
  };

  if (authLoading || !checked) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.bg, color: BRAND.inkMuted }}>Loading…</div>;
  }
  if (!isAdmin) return null;

  // ─── USER DETAIL VIEW ───────────────────
  if (selectedUser) {
    return (
      <Shell>
        <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-2 border-b"
          style={{ background: BRAND.bg, borderColor: BRAND.cardBorder }}>
          <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2"><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate" style={{ color: BRAND.inkMuted }}>{selectedUser.email}</p>
            <p className="font-bold truncate text-white">{selectedUser.full_name || "(no name)"}</p>
          </div>
          <button onClick={refresh} className="p-2"><RefreshCw className="h-4 w-4" /></button>
        </header>

        <main className="px-4 pt-4 space-y-4 pb-24">
          <div className="flex flex-wrap gap-2">
            {selectedUser.is_banned && <Pill color={BRAND.red}><Ban className="h-3 w-3 mr-1 inline" />Banned</Pill>}
            {selectedUser.is_suspicious && <Pill color={BRAND.orange}><AlertTriangle className="h-3 w-3 mr-1 inline" />Suspicious</Pill>}
            {selectedUser.test_withdrawal_used && <Pill color="rgba(255,255,255,0.5)">₹2 test used</Pill>}
            {!selectedUser.is_banned && !selectedUser.is_suspicious && <Pill color={BRAND.green}><BadgeCheck className="h-3 w-3 mr-1 inline" />Clean</Pill>}
          </div>

          <BrandCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: BRAND.inkMuted }}>Current balance</p>
              <p className="text-3xl font-extrabold tabular-nums" style={{ color: BRAND.orange }}>{selectedUser.coins.toLocaleString()}</p>
              <p className="text-[11px]" style={{ color: BRAND.inkMuted }}>≈ ₹{(selectedUser.coins / 12).toFixed(2)}</p>
            </div>
            <Coins className="h-10 w-10" style={{ color: BRAND.orangeSoft }} />
          </BrandCard>

          <div className="grid grid-cols-2 gap-2">
            <BrandBtn onClick={() => adjust(selectedUser, 1)} variant="green"><ArrowDownToLine className="h-4 w-4 mr-1" /> Credit</BrandBtn>
            <BrandBtn onClick={() => adjust(selectedUser, -1)} variant="orange"><ArrowUpFromLine className="h-4 w-4 mr-1" /> Debit</BrandBtn>
            <BrandBtn onClick={() => setBalance(selectedUser)} variant="ghost" className="col-span-2">
              <CircleDollarSign className="h-4 w-4 mr-1" /> Set exact balance
            </BrandBtn>
            <BrandBtn onClick={() => ban(selectedUser, !selectedUser.is_banned)} variant={selectedUser.is_banned ? "green" : "danger"}>
              {selectedUser.is_banned ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              {selectedUser.is_banned ? "Unban" : "Ban"}
            </BrandBtn>
            <BrandBtn onClick={() => flagSus(selectedUser, !selectedUser.is_suspicious)} variant="orange">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {selectedUser.is_suspicious ? "Clear flag" : "Suspicious"}
            </BrandBtn>
            <BrandBtn variant="ghost" className="col-span-2" onClick={() => {
              setBTarget("list"); setBUserIds(selectedUser.user_id); setSelectedUser(null); setTab("broadcast");
            }}>
              <Send className="h-4 w-4 mr-1" /> Send notification to user
            </BrandBtn>
          </div>

          <div>
            <h2 className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: BRAND.inkMuted }}>
              Transactions ({userTx.length})
            </h2>
            <div className="space-y-2">
              {userTx.length === 0 && <EmptyText>No transactions</EmptyText>}
              {userTx.map((tx) => {
                const isCredit = tx.amount > 0;
                const reversed = tx.status === "reversed";
                return (
                  <BrandCard key={tx.id} className={cn("p-3 flex items-center gap-3", reversed && "opacity-60")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">{tx.type} · {tx.source || "—"}</p>
                      <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>
                        {new Date(tx.created_at).toLocaleString()} · {tx.status}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums" style={{ color: isCredit ? BRAND.green : BRAND.red }}>
                      {isCredit ? "+" : ""}{tx.amount}
                    </p>
                    {isCredit && !reversed && (
                      <BrandBtn size="sm" variant="danger" onClick={() => reverseTx(tx)}>Reject</BrandBtn>
                    )}
                    {reversed && <Pill color="rgba(255,255,255,0.45)">Reversed</Pill>}
                  </BrandCard>
                );
              })}
            </div>
          </div>
        </main>
      </Shell>
    );
  }

  // ─── MAIN ADMIN VIEW ───────────────────
  return (
    <Shell>
      <header className="sticky top-0 z-20 px-4 py-3 flex items-center gap-2 border-b"
        style={{ background: BRAND.bg, borderColor: BRAND.cardBorder }}>
        <button onClick={() => navigate("/profile")} className="p-2 -ml-2"><ChevronLeft className="h-5 w-5" /></button>
        <ShieldCheck className="h-5 w-5" style={{ color: BRAND.green }} />
        <h1 className="text-lg font-extrabold flex-1 text-white">Admin Control</h1>
        <button onClick={refresh} className="p-2"><RefreshCw className="h-4 w-4" /></button>
      </header>

      {/* Tabs */}
      <div className="px-3 pt-3">
        <div className="rounded-2xl p-1 flex gap-1 overflow-x-auto"
          style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}` }}>
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn("shrink-0 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors")}
              style={tab === t.k
                ? { background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.orange})`, color: "#fff", boxShadow: `0 6px 18px ${BRAND.greenSoft}` }
                : { color: BRAND.inkMuted }}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4 space-y-3 pb-24">
        {/* ─── DASHBOARD ─── */}
        {tab === "dashboard" && (
          <>
            {!overview && <EmptyText>Loading…</EmptyText>}
            {overview && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Users total" value={overview.users_total} icon={<Users className="h-5 w-5" style={{ color: BRAND.green }} />} accent />
                  <Stat label="Today signups" value={overview.users_today} icon={<UserPlus className="h-5 w-5" style={{ color: BRAND.orange }} />} />
                  <Stat label="Banned" value={overview.users_banned} icon={<Ban className="h-5 w-5" style={{ color: BRAND.red }} />} />
                  <Stat label="Suspicious" value={overview.users_suspicious} icon={<AlertTriangle className="h-5 w-5" style={{ color: BRAND.orange }} />} />
                </div>

                <BrandCard className="p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>Withdrawals</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Pending" value={overview.pending_redemptions} sub={`₹${overview.pending_inr}`} />
                    <Mini label="Paid today" value={`₹${overview.paid_today_inr}`} sub={`₹${overview.paid_total_inr} total`} />
                  </div>
                </BrandCard>

                <BrandCard className="p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>Coin economy</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Mini label="Earned today" value={overview.coins_earned_today} />
                    <Mini label="Spent today" value={overview.coins_spent_today} />
                    <Mini label="In circulation" value={overview.coins_in_circulation} />
                  </div>
                </BrandCard>

                <BrandCard className="p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>Activity today</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Mini label="Tx" value={overview.transactions_today} />
                    <Mini label="Games" value={overview.game_plays_today} />
                    <Mini label="Quiz" value={overview.quiz_today} />
                  </div>
                </BrandCard>

                <BrandCard className="p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>Referrals</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Mini label="Total" value={overview.referrals_total} />
                    <Mini label="Credited" value={overview.referrals_credited} />
                  </div>
                </BrandCard>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <BrandBtn onClick={() => setTab("withdrawals")} variant="orange"><Wallet className="h-4 w-4 mr-1" /> Withdrawals</BrandBtn>
                  <BrandBtn onClick={() => setTab("broadcast")} variant="green"><Megaphone className="h-4 w-4 mr-1" /> Broadcast</BrandBtn>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── USERS ─── */}
        {tab === "users" && (
          <>
            <BrandCard className="flex items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4" style={{ color: BRAND.inkMuted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or name…"
                className="flex-1 bg-transparent text-sm outline-none text-white placeholder:opacity-50"
              />
            </BrandCard>

            {/* Bulk action bar */}
            <div className="flex items-center gap-2">
              <button onClick={selectAllOnPage} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}`, color: BRAND.ink }}>
                {users.length > 0 && users.every((u) => selectedIds.has(u.user_id))
                  ? <CheckSquare className="h-3.5 w-3.5" style={{ color: BRAND.green }} />
                  : <Square className="h-3.5 w-3.5" />}
                Select page
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold px-2 py-1 rounded-md"
                  style={{ background: BRAND.greenSoft, color: BRAND.green }}>
                  {selectedIds.size} selected
                </span>
              )}
              {selectedIds.size > 0 && (
                <button onClick={clearSelection} className="text-xs underline" style={{ color: BRAND.inkMuted }}>clear</button>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <BrandBtn size="sm" variant="green" onClick={() => bulkAdjust(1)}><ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Bulk credit</BrandBtn>
                <BrandBtn size="sm" variant="orange" onClick={() => bulkAdjust(-1)}><ArrowUpFromLine className="h-3.5 w-3.5 mr-1" /> Bulk debit</BrandBtn>
                <BrandBtn size="sm" variant="danger" onClick={() => bulkBan(true)}><Ban className="h-3.5 w-3.5 mr-1" /> Bulk ban</BrandBtn>
                <BrandBtn size="sm" variant="ghost" onClick={() => bulkBan(false)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bulk unban</BrandBtn>
              </div>
            )}

            {usersLoading && <EmptyText>Loading…</EmptyText>}

            <div className="space-y-2">
              {users.map((u) => {
                const sel = selectedIds.has(u.user_id);
                return (
                  <BrandCard key={u.user_id} className="p-3 flex items-center gap-3"
                    style={sel ? { borderColor: BRAND.green, background: "rgba(34,197,94,0.06)" } : undefined}>
                    <button onClick={() => toggleSelect(u.user_id)} className="p-1 -m-1 shrink-0">
                      {sel
                        ? <CheckSquare className="h-5 w-5" style={{ color: BRAND.green }} />
                        : <Square className="h-5 w-5" style={{ color: BRAND.inkMuted }} />}
                    </button>
                    <button onClick={() => setSelectedUser(u)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.orange})` }}>
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-white">{u.full_name || "(no name)"}</p>
                        <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>{u.email}</p>
                        <div className="flex gap-1 mt-1">
                          {u.is_banned && <Pill color={BRAND.red} small>Banned</Pill>}
                          {u.is_suspicious && <Pill color={BRAND.orange} small>Suspicious</Pill>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums" style={{ color: BRAND.orange }}>{u.coins.toLocaleString()}</p>
                        <Eye className="h-3.5 w-3.5 ml-auto mt-1" style={{ color: BRAND.inkMuted }} />
                      </div>
                    </button>
                  </BrandCard>
                );
              })}
              {users.length === 0 && !usersLoading && <EmptyText>No users found</EmptyText>}
            </div>

            <Paginator page={usersPage} setPage={setUsersPage} total={usersTotal} pageSize={PAGE_SIZE} />
          </>
        )}

        {/* ─── WITHDRAWALS ─── */}
        {tab === "withdrawals" && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {["pending", "approved", "paid", "rejected", ""].map((s) => (
                <button
                  key={s || "all"}
                  onClick={() => setRedStatus(s)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border"
                  style={redStatus === s
                    ? { background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.orange})`, color: "#fff", borderColor: "transparent" }
                    : { borderColor: BRAND.cardBorder, background: BRAND.card, color: BRAND.inkMuted }}
                >
                  {s ? s[0].toUpperCase() + s.slice(1) : "All"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {redemptions.map((r) => {
                const isTest = r.meta?.test_withdrawal === true;
                return (
                  <BrandCard key={r.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-white">
                          ₹{r.amount_inr} · {r.type === "upi" ? r.upi_id : r.brand}
                          {isTest && <Pill color="rgba(255,255,255,0.45)" small>TEST</Pill>}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>{r.email}</p>
                        <p className="text-[10px]" style={{ color: BRAND.inkMuted }}>
                          {new Date(r.created_at).toLocaleString()} · {r.coins_spent} NC
                        </p>
                        {r.meta?.utr && (
                          <p className="text-[10px] font-mono" style={{ color: BRAND.green }}>UTR: {r.meta.utr}</p>
                        )}
                      </div>
                      <Pill color={
                        r.status === "paid" ? BRAND.green :
                        r.status === "rejected" ? BRAND.red :
                        r.status === "approved" ? BRAND.orange : "rgba(255,255,255,0.45)"
                      } small>{r.status}</Pill>
                    </div>
                    {(r.status === "pending" || r.status === "approved") && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {r.status === "pending" && (
                          <BrandBtn size="sm" variant="ghost" onClick={() => updateRedemption(r, "approve")}>Approve</BrandBtn>
                        )}
                        <BrandBtn size="sm" variant="green" onClick={() => updateRedemption(r, "paid")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                        </BrandBtn>
                        <BrandBtn size="sm" variant="danger" onClick={() => updateRedemption(r, "reject")}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </BrandBtn>
                      </div>
                    )}
                    {r.status === "paid" && (
                      <BrandBtn size="sm" variant="ghost" className="w-full" onClick={() => updateRedemption(r, "unpaid")}>
                        Mark unpaid
                      </BrandBtn>
                    )}
                  </BrandCard>
                );
              })}
              {redemptions.length === 0 && <EmptyText>No {redStatus || "any"} withdrawals</EmptyText>}
            </div>
            <Paginator page={redPage} setPage={setRedPage} total={redTotal} pageSize={PAGE_SIZE} />
          </>
        )}

        {/* ─── TRANSACTIONS ─── */}
        {tab === "transactions" && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {["", "earn", "spend", "admin_adjust", "referral", "game", "quiz"].map((t) => (
                <button
                  key={t || "all"}
                  onClick={() => setTxType(t)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border"
                  style={txType === t
                    ? { background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.orange})`, color: "#fff", borderColor: "transparent" }
                    : { borderColor: BRAND.cardBorder, background: BRAND.card, color: BRAND.inkMuted }}
                >
                  {t || "All"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {recentTx.map((tx) => {
                const isCredit = tx.amount > 0;
                const reversed = tx.status === "reversed";
                return (
                  <BrandCard key={tx.id} className={cn("p-3 flex items-center gap-3", reversed && "opacity-60")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">{tx.type} · {tx.source || "—"}</p>
                      <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>{tx.email || "?"} · {tx.full_name || "—"}</p>
                      <p className="text-[10px]" style={{ color: BRAND.inkMuted }}>{new Date(tx.created_at).toLocaleString()} · {tx.status}</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums" style={{ color: isCredit ? BRAND.green : BRAND.red }}>
                      {isCredit ? "+" : ""}{tx.amount}
                    </p>
                    {isCredit && !reversed && (
                      <BrandBtn size="sm" variant="danger" onClick={() => reverseTx(tx)}>Reject</BrandBtn>
                    )}
                    {reversed && <Pill color="rgba(255,255,255,0.45)" small>Reversed</Pill>}
                  </BrandCard>
                );
              })}
              {recentTx.length === 0 && <EmptyText>No transactions</EmptyText>}
            </div>
            <Paginator page={txPage} setPage={setTxPage} total={txTotal} pageSize={PAGE_SIZE} />
          </>
        )}

        {/* ─── REFERRALS ─── */}
        {tab === "referrals" && (
          <div className="space-y-2">
            {referrals.map((r) => (
              <BrandCard key={r.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold truncate text-white">
                    Code <span style={{ color: BRAND.green }}>{r.code_used}</span>
                  </p>
                  <Pill color={r.status === "credited" ? BRAND.green : "rgba(255,255,255,0.45)"} small>{r.status}</Pill>
                </div>
                <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>
                  By: {r.referrer_email || r.referrer_id} → {r.referred_email || r.referred_user_id}
                </p>
                <p className="text-[10px]" style={{ color: BRAND.inkMuted }}>
                  {new Date(r.created_at).toLocaleString()} · +{r.referrer_reward}/+{r.referred_reward} NC
                </p>
                {r.device_fp && (
                  <p className="text-[10px] font-mono truncate" style={{ color: BRAND.inkMuted }}>fp: {r.device_fp.slice(0, 24)}…</p>
                )}
              </BrandCard>
            ))}
            {referrals.length === 0 && <EmptyText>No referrals</EmptyText>}
          </div>
        )}

        {/* ─── GAMES ─── */}
        {tab === "games" && (
          <div className="space-y-2">
            {gamePlays.map((g) => (
              <BrandCard key={g.id} className="p-3 flex items-center gap-3">
                <Gamepad2 className="h-5 w-5 shrink-0" style={{ color: BRAND.orange }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{g.game} · score {g.score}</p>
                  <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>{g.email || "?"}</p>
                  <p className="text-[10px]" style={{ color: BRAND.inkMuted }}>{new Date(g.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold tabular-nums" style={{ color: BRAND.orange }}>+{g.reward}</p>
              </BrandCard>
            ))}
            {gamePlays.length === 0 && <EmptyText>No game plays</EmptyText>}
          </div>
        )}

        {/* ─── QUIZ ─── */}
        {tab === "quiz" && (
          <div className="space-y-2">
            {quizzes.map((q) => (
              <BrandCard key={q.id} className="p-3 flex items-center gap-3">
                <Brain className="h-5 w-5 shrink-0" style={{ color: BRAND.green }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{q.score}/{q.total} · {q.category || "Mixed"}</p>
                  <p className="text-[11px] truncate" style={{ color: BRAND.inkMuted }}>{q.email || "?"}</p>
                  <p className="text-[10px]" style={{ color: BRAND.inkMuted }}>{new Date(q.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold tabular-nums" style={{ color: BRAND.orange }}>+{q.reward}</p>
              </BrandCard>
            ))}
            {quizzes.length === 0 && <EmptyText>No quiz attempts</EmptyText>}
          </div>
        )}

        {/* ─── BROADCAST ─── */}
        {tab === "broadcast" && (
          <div className="space-y-3">
            <BrandCard className="p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>Send notification</p>
              <Input value={bTitle} onChange={(v) => setBTitle(v)} placeholder="Title (e.g., 🎉 New offer live!)" />
              <TextArea value={bBody} onChange={(v) => setBBody(v)} placeholder="Message body (optional)" rows={3} />
              <div className="grid grid-cols-4 gap-1.5">
                {(["all", "active", "banned", "list"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBTarget(opt)}
                    className="rounded-xl py-2 text-xs font-bold capitalize transition-colors"
                    style={bTarget === opt
                      ? { background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.orange})`, color: "#fff" }
                      : { background: BRAND.card, color: BRAND.inkMuted, border: `1px solid ${BRAND.cardBorder}` }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {bTarget === "list" && (
                <TextArea value={bUserIds} onChange={(v) => setBUserIds(v)} placeholder="User IDs (comma or newline separated)" rows={3} mono />
              )}
              <BrandBtn onClick={sendBroadcast} disabled={bSending} variant="green" className="w-full">
                <Send className="h-4 w-4 mr-1" />
                {bSending ? "Sending…" : "Broadcast"}
              </BrandBtn>
            </BrandCard>
            <BrandCard className="p-3 text-[11px]" style={{ color: BRAND.inkMuted }}>
              <p className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Tip: Set "list" to send to specific user IDs.</p>
            </BrandCard>
          </div>
        )}

        {/* ─── NOTIFICATIONS ─── */}
        {tab === "notifications" && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider px-1" style={{ color: BRAND.inkMuted }}>
              Latest notifications across all users
            </p>
            {notifs.map((n) => (
              <BrandCard key={n.id} className="p-3 flex items-start gap-2">
                <Bell className="h-4 w-4 shrink-0 mt-0.5" style={{ color: BRAND.green }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{n.title}</p>
                  {n.body && <p className="text-[11px] line-clamp-2" style={{ color: BRAND.inkMuted }}>{n.body}</p>}
                  <p className="text-[10px] truncate" style={{ color: BRAND.inkMuted }}>
                    {n.email || "?"} · {n.type} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => deleteNotif(n.id)} className="p-1.5 rounded-md hover:bg-white/5">
                  <Trash2 className="h-3.5 w-3.5" style={{ color: BRAND.red }} />
                </button>
              </BrandCard>
            ))}
            {notifs.length === 0 && <EmptyText>No notifications</EmptyText>}
          </div>
        )}
      </main>
    </Shell>
  );
};

// ───────────── UI primitives (brand-scoped) ─────────────

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-screen pb-12" style={{ background: BRAND.bg, color: BRAND.ink }}>
    {children}
  </div>
);

const BrandCard = ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={cn("rounded-2xl", className)} style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}`, ...style }}>
    {children}
  </div>
);

const Pill = ({ children, color, small }: { children: React.ReactNode; color: string; small?: boolean }) => (
  <span className={cn("inline-flex items-center rounded-full font-bold ml-1 first:ml-0",
    small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5")}
    style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
    {children}
  </span>
);

const EmptyText = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-center py-8" style={{ color: BRAND.inkMuted }}>{children}</p>
);

type BtnVariant = "green" | "orange" | "danger" | "ghost";
const BrandBtn = ({
  children, onClick, disabled, className, variant = "ghost", size = "md",
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  className?: string; variant?: BtnVariant; size?: "sm" | "md";
}) => {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    green:  { background: BRAND.green, color: "#0b1410" },
    orange: { background: BRAND.orange, color: "#1a0e02" },
    danger: { background: BRAND.red, color: "#fff" },
    ghost:  { background: BRAND.card, color: BRAND.ink, border: `1px solid ${BRAND.cardBorder}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl font-bold transition-all active:scale-[0.98] inline-flex items-center justify-center disabled:opacity-50",
        size === "sm" ? "text-xs px-3 h-8" : "text-sm px-4 h-10",
        className
      )}
      style={styles[variant]}
    >
      {children}
    </button>
  );
};

const Input = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none text-white placeholder:opacity-50"
    style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}` }}
  />
);

const TextArea = ({ value, onChange, placeholder, rows, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; mono?: boolean;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows ?? 3}
    className={cn("w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none text-white placeholder:opacity-50", mono && "font-mono text-xs")}
    style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}` }}
  />
);

const Stat = ({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) => (
  <div className="rounded-2xl p-3"
    style={{
      background: BRAND.card,
      border: `1px solid ${accent ? BRAND.green : BRAND.cardBorder}`,
      boxShadow: accent ? `0 0 0 3px ${BRAND.greenSoft}` : undefined,
    }}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-extrabold tabular-nums mt-1 text-white">
      {typeof value === "number" ? (value ?? 0).toLocaleString() : value ?? 0}
    </p>
  </div>
);

const Mini = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => (
  <div className="rounded-xl p-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BRAND.cardBorder}` }}>
    <p className="text-[9px] uppercase tracking-wider" style={{ color: BRAND.inkMuted }}>{label}</p>
    <p className="text-base font-extrabold tabular-nums text-white">
      {typeof value === "number" ? (value ?? 0).toLocaleString() : value ?? 0}
    </p>
    {sub && <p className="text-[9px] truncate" style={{ color: BRAND.inkMuted }}>{sub}</p>}
  </div>
);

const Paginator = ({ page, setPage, total, pageSize }: {
  page: number; setPage: (n: number) => void; total: number; pageSize: number;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between rounded-2xl px-3 py-2"
      style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}` }}>
      <p className="text-[11px]" style={{ color: BRAND.inkMuted }}>
        {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => setPage(Math.max(0, page - 1))}
          className="h-8 w-8 rounded-lg inline-flex items-center justify-center disabled:opacity-30"
          style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}`, color: BRAND.ink }}
        ><ChevLeft className="h-4 w-4" /></button>
        <span className="text-xs font-bold px-2 min-w-[3.5rem] text-center text-white">{page + 1} / {pages}</span>
        <button
          disabled={page + 1 >= pages}
          onClick={() => setPage(page + 1)}
          className="h-8 w-8 rounded-lg inline-flex items-center justify-center disabled:opacity-30"
          style={{ background: BRAND.card, border: `1px solid ${BRAND.cardBorder}`, color: BRAND.ink }}
        ><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
};

export default Admin;
