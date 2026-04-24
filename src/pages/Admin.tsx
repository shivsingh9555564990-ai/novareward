import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldAlert, Search, Users, Wallet, AlertTriangle, Ban, CheckCircle2,
  XCircle, IndianRupee, Coins, ChevronLeft, RefreshCw, Eye, ShieldCheck,
  ArrowDownToLine, ArrowUpFromLine, BadgeCheck,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  coins: number;
  is_banned: boolean;
  is_suspicious: boolean;
  test_withdrawal_used: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

type Tx = {
  id: string;
  type: string;
  source: string | null;
  amount: number;
  status: string;
  reference_id: string | null;
  meta: any;
  created_at: string;
};

type Redemption = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  type: string;
  brand: string | null;
  amount_inr: number;
  coins_spent: number;
  upi_id: string | null;
  status: string;
  meta: any;
  created_at: string;
};

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, checked } = useIsAdmin();

  const [tab, setTab] = useState<"users" | "withdrawals" | "stats">("withdrawals");
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [userTx, setUserTx] = useState<Tx[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [redStatus, setRedStatus] = useState<string>("pending");
  const [refreshTick, setRefreshTick] = useState(0);

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

  // Stats
  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("admin_stats").then(({ data }) => setStats(data));
  }, [isAdmin, refreshTick]);

  // Search users (debounced-ish)
  const loadUsers = useCallback(async (q: string) => {
    setUsersLoading(true);
    const { data, error } = await supabase.rpc("admin_search_users", {
      p_query: q,
      p_limit: 50,
    });
    setUsersLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers((data ?? []) as AdminUserRow[]);
  }, []);

  useEffect(() => {
    if (!isAdmin || tab !== "users") return;
    const t = setTimeout(() => loadUsers(search), 250);
    return () => clearTimeout(t);
  }, [isAdmin, tab, search, loadUsers, refreshTick]);

  // Withdrawals
  useEffect(() => {
    if (!isAdmin || tab !== "withdrawals") return;
    supabase.rpc("admin_list_redemptions", { p_status: redStatus, p_limit: 100 })
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setRedemptions((data ?? []) as Redemption[]);
      });
  }, [isAdmin, tab, redStatus, refreshTick]);

  // User detail tx list
  useEffect(() => {
    if (!selectedUser) { setUserTx([]); return; }
    supabase.rpc("admin_list_user_transactions", {
      p_user_id: selectedUser.user_id,
      p_limit: 100,
    }).then(({ data }) => setUserTx((data ?? []) as Tx[]));
  }, [selectedUser, refreshTick]);

  const refresh = () => setRefreshTick((x) => x + 1);

  // ─── ACTIONS ───────────────────────
  const ban = async (u: AdminUserRow, banned: boolean) => {
    let reason: string | null = null;
    if (banned) {
      reason = window.prompt("Ban reason (shown to user):") || "Account flagged";
    }
    const { error } = await supabase.rpc("admin_set_ban", {
      p_user_id: u.user_id, p_banned: banned, p_reason: reason,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(banned ? "User banned" : "User unbanned");
    refresh();
  };

  const flagSus = async (u: AdminUserRow, flag: boolean) => {
    const { error } = await supabase.rpc("admin_set_suspicious", {
      p_user_id: u.user_id, p_flag: flag,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(flag ? "Marked suspicious" : "Cleared flag");
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

  if (authLoading || !checked) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) return null;

  // ─── USER DETAIL VIEW ───────────────────
  if (selectedUser) {
    return (
      <div className="relative min-h-screen pb-28">
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
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {selectedUser.is_banned && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Banned</Badge>}
            {selectedUser.is_suspicious && <Badge className="bg-coin text-background"><AlertTriangle className="h-3 w-3 mr-1" />Suspicious</Badge>}
            {selectedUser.test_withdrawal_used && <Badge variant="outline">₹2 test used</Badge>}
            {!selectedUser.is_banned && !selectedUser.is_suspicious && <Badge className="bg-success/20 text-success"><BadgeCheck className="h-3 w-3 mr-1" />Clean</Badge>}
          </div>

          {/* Coin card */}
          <div className="glass rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current balance</p>
              <p className="text-3xl font-extrabold text-coin tabular-nums">{selectedUser.coins.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">≈ ₹{(selectedUser.coins / 12).toFixed(2)}</p>
            </div>
            <Coins className="h-10 w-10 text-coin/40" />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => adjust(selectedUser, 1)}>
              <ArrowDownToLine className="h-4 w-4 mr-1" /> Credit NC
            </Button>
            <Button variant="outline" onClick={() => adjust(selectedUser, -1)}>
              <ArrowUpFromLine className="h-4 w-4 mr-1" /> Debit NC
            </Button>
            <Button variant={selectedUser.is_banned ? "default" : "destructive"} onClick={() => ban(selectedUser, !selectedUser.is_banned)}>
              {selectedUser.is_banned ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
              {selectedUser.is_banned ? "Unban" : "Ban"}
            </Button>
            <Button variant={selectedUser.is_suspicious ? "default" : "outline"} onClick={() => flagSus(selectedUser, !selectedUser.is_suspicious)}>
              <AlertTriangle className="h-4 w-4 mr-1" />
              {selectedUser.is_suspicious ? "Clear flag" : "Mark suspicious"}
            </Button>
          </div>

          {/* Transactions with reject buttons */}
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
                      <p className="text-sm font-semibold truncate">
                        {tx.type} · {tx.source || "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {new Date(tx.created_at).toLocaleString()} · {tx.status}
                      </p>
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
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ─── MAIN ADMIN VIEW ───────────────────
  return (
    <div className="relative min-h-screen pb-28">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/40 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate("/profile")} className="p-2 -ml-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-extrabold flex-1">Admin</h1>
        <button onClick={refresh} className="p-2"><RefreshCw className="h-4 w-4" /></button>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <div className="glass grid grid-cols-3 gap-1 rounded-2xl p-1">
          {[
            { k: "withdrawals", label: "Withdrawals", icon: Wallet },
            { k: "users", label: "Users", icon: Users },
            { k: "stats", label: "Stats", icon: ShieldAlert },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={cn(
                "rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1 transition-smooth",
                tab === t.k ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 pt-4 space-y-3">
        {tab === "stats" && stats && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Users" value={stats.users_total} icon={<Users className="h-5 w-5 text-primary" />} />
            <StatCard label="Banned" value={stats.users_banned} icon={<Ban className="h-5 w-5 text-destructive" />} />
            <StatCard label="Suspicious" value={stats.users_suspicious} icon={<AlertTriangle className="h-5 w-5 text-coin" />} />
            <StatCard label="Pending withdrawals" value={stats.pending_redemptions} icon={<Wallet className="h-5 w-5 text-accent" />} />
            <StatCard label="Paid (₹)" value={stats.paid_total_inr} icon={<IndianRupee className="h-5 w-5 text-success" />} />
            <StatCard label="Coins live" value={stats.coins_in_circulation} icon={<Coins className="h-5 w-5 text-coin" />} />
          </div>
        )}

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
                      } className="text-[10px]">
                        {r.status}
                      </Badge>
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
      </main>
      <BottomNav />
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) => (
  <div className="glass rounded-2xl p-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-extrabold tabular-nums mt-1">{(value ?? 0).toLocaleString()}</p>
  </div>
);

export default Admin;
