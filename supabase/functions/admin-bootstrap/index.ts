// One-time admin bootstrap: ensures the hardcoded admin email exists,
// has a confirmed email, the requested password set, and the 'admin' role.
// Public endpoint (no JWT) — but it ONLY operates on the single hardcoded
// admin email. Any other email is rejected. Safe to call multiple times.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_EMAIL = "shivsingh9555564990@gmail.com";
const ADMIN_PASSWORD = "Shivpro@#";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Find existing user by listing (paginate up to ~1000 users)
  let existingUserId: string | null = null;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return json({ success: false, error: error.message }, 500);
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL);
    if (found) { existingUserId = found.id; break; }
    if (data.users.length < 100) break;
  }

  let userId = existingUserId;
  let action: "created" | "updated" = "updated";

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Admin" },
    });
    if (error) return json({ success: false, error: error.message }, 500);
    userId = data.user!.id;
    action = "created";
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) return json({ success: false, error: error.message }, 500);
  }

  // 2) Ensure profile exists (handle_new_user trigger normally creates it,
  //    but be safe for pre-existing accounts created before the trigger).
  await admin.from("profiles").upsert(
    { id: userId, full_name: "Admin" },
    { onConflict: "id", ignoreDuplicates: true },
  );

  // 3) Ensure admin role
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (roleErr) return json({ success: false, error: roleErr.message }, 500);

  return json({
    success: true,
    action,
    user_id: userId,
    email: ADMIN_EMAIL,
    message: "Admin ready. You can now login with the configured password.",
  });
});
