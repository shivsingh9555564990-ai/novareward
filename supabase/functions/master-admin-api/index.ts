// Master Admin API — single POST endpoint with `action` router.
// Auth: requires logged-in user with role='admin' in public.user_roles.
// Uses SERVICE_ROLE_KEY internally to bypass RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ok(data: unknown = {}) {
  return json({ success: true, ...((data && typeof data === "object") ? data : { data }) });
}
function err(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error, ...extra }, status);
}

interface ActionCtx {
  admin: any;
  userClient: any;
  adminUserId: string;
  payload: Record<string, any>;
}

const handlers: Record<string, (ctx: ActionCtx) => Promise<Response>> = {
  // ───────────────── USERS ─────────────────
  async list_users({ admin, payload }) {
    const q = String(payload.query ?? "");
    const limit = Math.min(Math.max(Number(payload.limit ?? 50), 1), 200);
    const { data, error } = await admin.rpc("admin_search_users", { p_query: q, p_limit: limit });
    if (error) return err(error.message, 500);
    return ok({ users: data });
  },

  async get_user_details({ admin, payload }) {
    const userId = String(payload.user_id ?? "");
    if (!userId) return err("user_id required");
    const { data, error } = await admin.rpc("admin_get_user", { p_user_id: userId });
    if (error) return err(error.message, 500);
    return json(data);
  },

  async list_user_transactions({ admin, payload }) {
    const userId = String(payload.user_id ?? "");
    if (!userId) return err("user_id required");
    const limit = Math.min(Math.max(Number(payload.limit ?? 100), 1), 500);
    const { data, error } = await admin.rpc("admin_list_user_transactions", {
      p_user_id: userId,
      p_limit: limit,
    });
    if (error) return err(error.message, 500);
    return ok({ transactions: data });
  },

  async ban_user({ admin, payload }) {
    const userId = String(payload.user_id ?? "");
    const banned = Boolean(payload.banned ?? true);
    const reason = payload.reason ? String(payload.reason) : null;
    if (!userId) return err("user_id required");
    const { data, error } = await admin.rpc("admin_set_ban", {
      p_user_id: userId,
      p_banned: banned,
      p_reason: reason,
    });
    if (error) return err(error.message, 500);
    return json(data);
  },

  async flag_suspicious({ admin, payload }) {
    const userId = String(payload.user_id ?? "");
    const flag = Boolean(payload.flag ?? true);
    if (!userId) return err("user_id required");
    const { data, error } = await admin.rpc("admin_set_suspicious", {
      p_user_id: userId,
      p_flag: flag,
    });
    if (error) return err(error.message, 500);
    return json(data);
  },

  // ───────────────── COINS ─────────────────
  async adjust_coins({ admin, payload }) {
    const userId = String(payload.user_id ?? "");
    const amount = Number(payload.amount ?? 0);
    const note = payload.note ? String(payload.note) : null;
    if (!userId) return err("user_id required");
    if (!Number.isFinite(amount) || amount === 0) return err("amount must be non-zero");
    const { data, error } = await admin.rpc("admin_adjust_coins", {
      p_user_id: userId,
      p_amount: Math.trunc(amount),
      p_note: note,
    });
    if (error) return err(error.message, 500);
    return json(data);
  },

  async reverse_transaction({ admin, payload }) {
    const txId = String(payload.tx_id ?? "");
    const reason = payload.reason ? String(payload.reason) : null;
    if (!txId) return err("tx_id required");
    const { data, error } = await admin.rpc("admin_reverse_transaction", {
      p_tx_id: txId,
      p_reason: reason,
    });
    if (error) return err(error.message, 500);
    return json(data);
  },

  // ─────────────── REDEMPTIONS ───────────────
  async list_redemptions({ admin, payload }) {
    const status = payload.status ? String(payload.status) : "pending";
    const limit = Math.min(Math.max(Number(payload.limit ?? 100), 1), 500);
    const { data, error } = await admin.rpc("admin_list_redemptions", {
      p_status: status,
      p_limit: limit,
    });
    if (error) return err(error.message, 500);
    return ok({ redemptions: data });
  },

  async update_redemption({ admin, payload }) {
    const id = String(payload.redemption_id ?? "");
    const action = String(payload.redemption_action ?? "");
    const utr = payload.utr ? String(payload.utr) : null;
    const note = payload.note ? String(payload.note) : null;
    if (!id) return err("redemption_id required");
    if (!["approve", "reject", "paid", "unpaid"].includes(action)) return err("invalid redemption_action");
    const { data, error } = await admin.rpc("admin_update_redemption", {
      p_redemption_id: id,
      p_action: action,
      p_utr: utr,
      p_note: note,
    });
    if (error) return err(error.message, 500);
    return json(data);
  },

  // ─────────────── COMMUNICATIONS ───────────────
  async send_announcement({ admin, payload }) {
    const title = String(payload.title ?? "").slice(0, 200);
    const body = String(payload.body ?? "").slice(0, 2000);
    const target = String(payload.target ?? "all"); // all | banned_excluded | suspicious | user_ids
    const userIds: string[] = Array.isArray(payload.user_ids) ? payload.user_ids : [];
    if (!title) return err("title required");

    let recipients: { id: string }[] = [];
    if (target === "user_ids") {
      if (userIds.length === 0) return err("user_ids required");
      const { data, error } = await admin.from("profiles").select("id").in("id", userIds);
      if (error) return err(error.message, 500);
      recipients = data ?? [];
    } else {
      let q = admin.from("profiles").select("id");
      if (target === "banned_excluded") q = q.eq("is_banned", false);
      if (target === "suspicious") q = q.eq("is_suspicious", true);
      const { data, error } = await q.limit(50000);
      if (error) return err(error.message, 500);
      recipients = data ?? [];
    }

    if (recipients.length === 0) return ok({ sent: 0 });

    const rows = recipients.map((r) => ({
      user_id: r.id,
      title,
      body,
      type: "system",
      meta: { source: "admin_announcement" },
    }));

    // chunk insert to avoid huge payloads
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error } = await admin.from("notifications").insert(slice);
      if (error) return err(error.message, 500, { inserted });
      inserted += slice.length;
    }
    return ok({ sent: inserted });
  },

  // ─────────────── STATS ───────────────
  async stats({ admin }) {
    const { data, error } = await admin.rpc("admin_stats");
    if (error) return err(error.message, 500);
    return ok({ stats: data });
  },

  async recent_redemptions({ admin, payload }) {
    const limit = Math.min(Math.max(Number(payload.limit ?? 20), 1), 100);
    const { data, error } = await admin
      .from("redemptions")
      .select("id,user_id,type,brand,amount_inr,coins_spent,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return err(error.message, 500);
    return ok({ redemptions: data });
  },

  async recent_transactions({ admin, payload }) {
    const limit = Math.min(Math.max(Number(payload.limit ?? 20), 1), 100);
    const { data, error } = await admin
      .from("transactions")
      .select("id,user_id,type,source,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return err(error.message, 500);
    return ok({ transactions: data });
  },

  // ─────────────── DEBUG ───────────────
  async whoami({ adminUserId }) {
    return ok({ admin_user_id: adminUserId });
  },

  async list_actions() {
    return ok({ actions: Object.keys(handlers).sort() });
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // verify the JWT and get user id
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return err("unauthorized", 401);
  const adminUserId = claimsData.claims.sub as string;

  // verify admin role using service role to avoid RLS surprises
  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr) return err(roleErr.message, 500);
  if (!roleRow) return err("forbidden_admin_only", 403);

  let payload: Record<string, any> = {};
  let action = "";
  try {
    const body = await req.json();
    action = String(body?.action ?? "");
    payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  } catch {
    return err("invalid_json", 400);
  }
  if (!action) return err("action required");

  const handler = handlers[action];
  if (!handler) return err(`unknown_action:${action}`, 404);

  try {
    return await handler({ admin, userClient, adminUserId, payload });
  } catch (e) {
    return err(e instanceof Error ? e.message : "internal_error", 500);
  }
});
