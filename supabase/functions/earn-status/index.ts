// Returns claimable status for the current user across earn modules.
// GET /functions/v1/earn-status -> { spin, scratch, daily_bonus, today_earned, balance }
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (cErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: activities }, { data: profile }, { data: txs }] = await Promise.all([
    supabase.from("daily_activity").select("activity, reward").eq("user_id", userId).eq("activity_date", today),
    supabase.from("profiles").select("coins").eq("id", userId).maybeSingle(),
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00.000Z`),
  ]);

  const claimedMap: Record<string, number> = {};
  (activities ?? []).forEach((a) => (claimedMap[a.activity] = a.reward));

  const todayEarned = (txs ?? []).reduce((s, t) => s + Math.max(0, t.amount), 0);

  return new Response(
    JSON.stringify({
      success: true,
      balance: profile?.coins ?? 0,
      today_earned: todayEarned,
      modules: {
        spin: { claimed: !!claimedMap.spin, reward: claimedMap.spin ?? null, max: 500 },
        scratch: { claimed: !!claimedMap.scratch, reward: claimedMap.scratch ?? null, max: 300 },
        daily_bonus: { claimed: !!claimedMap.daily_bonus, reward: claimedMap.daily_bonus ?? null, max: 50 },
        cpx: { available: true, status: "pending_approval" },
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
