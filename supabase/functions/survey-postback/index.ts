// Generic survey postback endpoint — works with ANY survey provider (CPX, AdGate,
// OfferToro, BitLabs, Pollfish, TheoremReach, Wannads, RevU, etc.).
//
// Postback URL format (give this to your survey partner):
//   https://<project>.supabase.co/functions/v1/survey-postback
//     ?user_id={USER_ID}              // your app's user_id (subID)
//     &tx_id={TRANSACTION_ID}         // partner's unique transaction id
//     &amount={REWARD_INR_OR_USD}     // numeric payout from partner
//     &currency=INR|USD               // optional, defaults INR
//     &provider=cpx|adgate|...        // partner short name
//     &status=1                       // 1 = credit, 2 = reversal, optional
//     &hash={SIGNATURE}               // md5/sha256 signature (see below)
//     &raw={...}                      // any extra fields will be stored in meta
//
// Signature options (set provider in Lovable Cloud secrets):
//   CPX:           md5(tx_id + secret) — pass via SURVEY_CPX_SECRET
//   AdGateMedia:   md5(tx_id + user_id + secret) — pass via SURVEY_ADGATE_SECRET
//   OfferToro:     md5(tx_id + secret + user_id) — pass via SURVEY_OFFERTORO_SECRET
//   Pollfish:      sha1(secret + tx_id) — pass via SURVEY_POLLFISH_SECRET
//   BitLabs:       sha1(tx_id + user_id + secret) — pass via SURVEY_BITLABS_SECRET
//   TheoremReach:  sha1(secret + tx_id) — pass via SURVEY_THEOREMREACH_SECRET
//   Generic/dev:   sha256(provider + tx_id + user_id + amount + secret)
//                  — pass via SURVEY_GENERIC_SECRET (recommended for new providers)
//
// 1 INR ≈ 12 Nova Coins. 1 USD ≈ 990 Nova Coins (conservative ₹82.5 → 990 NC).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const NC_PER_INR = 12;
const NC_PER_USD = 990;

const enc = (s: string) => new TextEncoder().encode(s);
async function md5(s: string) {
  // md5 via Web Crypto isn't available — fall back to manual implementation
  // Use a tiny portable md5 from npm
  const { default: md5fn } = await import("https://esm.sh/blueimp-md5@2.19.0");
  return md5fn(s);
}
async function sha(algo: "SHA-1" | "SHA-256", s: string) {
  const hash = await crypto.subtle.digest(algo, enc(s));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface VerifyResult { ok: boolean; expected?: string }

async function verifySignature(
  provider: string,
  txId: string,
  userId: string,
  amount: string,
  hash: string
): Promise<VerifyResult> {
  const p = provider.toLowerCase();
  let expected = "";
  switch (p) {
    case "cpx": {
      const secret = Deno.env.get("SURVEY_CPX_SECRET");
      if (!secret) return { ok: false };
      expected = await md5(`${txId}${secret}`);
      break;
    }
    case "adgate":
    case "adgatemedia": {
      const secret = Deno.env.get("SURVEY_ADGATE_SECRET");
      if (!secret) return { ok: false };
      expected = await md5(`${txId}${userId}${secret}`);
      break;
    }
    case "offertoro": {
      const secret = Deno.env.get("SURVEY_OFFERTORO_SECRET");
      if (!secret) return { ok: false };
      expected = await md5(`${txId}${secret}${userId}`);
      break;
    }
    case "pollfish": {
      const secret = Deno.env.get("SURVEY_POLLFISH_SECRET");
      if (!secret) return { ok: false };
      expected = await sha("SHA-1", `${secret}${txId}`);
      break;
    }
    case "bitlabs": {
      const secret = Deno.env.get("SURVEY_BITLABS_SECRET");
      if (!secret) return { ok: false };
      expected = await sha("SHA-1", `${txId}${userId}${secret}`);
      break;
    }
    case "theoremreach": {
      const secret = Deno.env.get("SURVEY_THEOREMREACH_SECRET");
      if (!secret) return { ok: false };
      expected = await sha("SHA-1", `${secret}${txId}`);
      break;
    }
    default: {
      const secret = Deno.env.get("SURVEY_GENERIC_SECRET");
      if (!secret) return { ok: false };
      expected = await sha("SHA-256", `${p}${txId}${userId}${amount}${secret}`);
    }
  }
  return { ok: expected.toLowerCase() === hash.toLowerCase(), expected };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());

    // For POST, also merge JSON body
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try { Object.assign(params, await req.json()); } catch (_) { /* noop */ }
      } else if (ct.includes("application/x-www-form-urlencoded")) {
        const body = await req.text();
        for (const [k, v] of new URLSearchParams(body).entries()) params[k] = v;
      }
    }

    const userId = String(params.user_id || params.subid || params.sub_id || "").trim();
    const txId = String(params.tx_id || params.trans_id || params.transaction_id || "").trim();
    const amountStr = String(params.amount || params.payout || params.reward || "0").trim();
    const provider = String(params.provider || "generic").trim();
    const currency = String(params.currency || "INR").toUpperCase();
    const status = String(params.status || "1").trim();
    const hash = String(params.hash || params.signature || params.sig || "").trim();

    if (!userId || !txId || !amountStr || !hash) {
      return new Response("missing params", { status: 400, headers: corsHeaders });
    }

    const amountNum = parseFloat(amountStr);
    if (!isFinite(amountNum) || amountNum <= 0) {
      return new Response("bad amount", { status: 400, headers: corsHeaders });
    }

    const verify = await verifySignature(provider, txId, userId, amountStr, hash);
    if (!verify.ok) {
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }

    // Reversal — credit negative
    const sign = status === "2" || status.toLowerCase() === "reverse" ? -1 : 1;

    const coins = Math.round(amountNum * (currency === "USD" ? NC_PER_USD : NC_PER_INR)) * sign;
    if (coins === 0) {
      return new Response("zero coins", { status: 400, headers: corsHeaders });
    }

    const referenceId = `${provider}:${txId}`;

    const { data, error } = await supabase.rpc("credit_user_coins", {
      p_user_id: userId,
      p_amount: coins,
      p_type: sign > 0 ? "survey_credit" : "survey_reversal",
      p_source: provider,
      p_reference_id: referenceId,
      p_meta: { ...params, currency, raw_amount: amountNum },
    });

    if (error) {
      console.error("credit_user_coins error", error);
      return new Response("db error", { status: 500, headers: corsHeaders });
    }

    // Most networks expect a plain "1" or "OK" body
    return new Response("1", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
  } catch (e) {
    console.error("postback error", e);
    return new Response("server error", { status: 500, headers: corsHeaders });
  }
});
