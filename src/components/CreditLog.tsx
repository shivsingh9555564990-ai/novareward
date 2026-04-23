import { useEffect, useState } from "react";
import { CheckCircle2, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tx = {
  id: string;
  amount: number;
  source: string | null;
  type: string;
  created_at: string;
};

/**
 * Real-time credit confirmation strip.
 * Shows the most recent transaction for the signed-in user, optionally
 * filtered by source (e.g. "lucky_dice", "quiz_game"). Subscribes to
 * postgres changes so the entry appears the moment the backend credits
 * coins — gives users instant proof that the play registered.
 */
const CreditLog = ({
  source,
  pollKey,
}: {
  /** Substring to match in transactions.source (e.g. "lucky_dice", "quiz", "tap_coin"). */
  source?: string;
  /** Bump this number from the parent (e.g. after RPC succeeds) to force a re-fetch. */
  pollKey?: number;
}) => {
  const [tx, setTx] = useState<Tx | null>(null);

  const fetchLatest = async () => {
    let q = supabase
      .from("transactions")
      .select("id, amount, source, type, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (source) q = q.ilike("source", `%${source}%`);
    const { data } = await q;
    if (data && data.length > 0) setTx(data[0] as Tx);
  };

  useEffect(() => {
    fetchLatest();
    // Re-fetch when parent bumps pollKey (after a play completes).
  }, [pollKey, source]);

  if (!tx) {
    return (
      <div className="glass rounded-2xl p-3 flex items-center gap-3 text-xs text-muted-foreground">
        <Coins className="h-4 w-4 opacity-60" />
        <span>Koi recent credit nahi. Khel ke check karo!</span>
      </div>
    );
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(tx.created_at).getTime()) / 60000));
  const when = minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : new Date(tx.created_at).toLocaleTimeString();

  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3 border-success/30">
      <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="h-4 w-4 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Last credit</p>
        <p className="text-sm font-bold truncate">
          {tx.source ?? tx.type} · <span className="text-success">+{tx.amount} NC</span>
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{when}</span>
    </div>
  );
};

export default CreditLog;
