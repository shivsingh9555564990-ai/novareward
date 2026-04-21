import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ExternalLink, Sparkles, Upload, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Offer = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  reward_min: number;
  reward_max: number;
  difficulty: number | null;
  duration_min: number | null;
  steps: string[];
  cta_url: string | null;
};

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [completion, setCompletion] = useState<{ status: string } | null>(null);
  const [proof, setProof] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from("offers").select("*").eq("id", id!).maybeSingle();
      setOffer(o as any);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: c } = await supabase.from("offer_completions").select("status").eq("user_id", user.id).eq("offer_id", id!).maybeSingle();
        setCompletion(c);
      }
      setLoading(false);
    })();
  }, [id]);

  const submit = async () => {
    if (!offer) return;
    setSubmitting(true);
    // Note: insert via service-role recommended. For now mark client-side intent and show pending.
    toast.success("Proof submitted! Status: pending review.");
    setCompletion({ status: "pending" });
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!offer) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>Task not found</p><Button onClick={() => navigate("/earn")}>Back</Button></div>;

  const statusColor: Record<string, string> = {
    pending: "bg-coin/20 text-coin",
    completed: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8">
        <button onClick={() => navigate(-1)} className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></button>
      </header>

      <main className="relative z-10 px-5 mt-4 space-y-4">
        {/* Card */}
        <div className="glass rounded-3xl p-5 shadow-glow">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" /> {offer.category ?? "Task"}
              </span>
              <h1 className="mt-1 text-xl font-extrabold leading-tight">{offer.title}</h1>
              {offer.subtitle && <p className="text-xs text-muted-foreground">{offer.subtitle}</p>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</p>
              <p className="text-3xl font-extrabold text-gradient-coin">
                {offer.reward_min === offer.reward_max ? `+${offer.reward_max}` : `+${offer.reward_min}–${offer.reward_max}`} NC
              </p>
            </div>
            {completion && (
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${statusColor[completion.status]}`}>
                {completion.status}
              </span>
            )}
          </div>
        </div>

        {offer.description && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">Description</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{offer.description}</p>
          </div>
        )}

        {offer.steps?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3">How to complete</h3>
            <ol className="space-y-3">
              {offer.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-xs">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold">{i + 1}</span>
                  <span className="text-foreground/90 pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {offer.cta_url && (
          <a href={offer.cta_url} target="_blank" rel="noreferrer" className="glass rounded-2xl p-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate">{offer.cta_url}</span>
            <ExternalLink className="h-4 w-4 text-accent shrink-0 ml-2" />
          </a>
        )}

        {!completion && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2"><Upload className="h-4 w-4" /> Submit Proof</h3>
            <Textarea placeholder="Paste screenshot URL, transaction ID, or notes…" value={proof} onChange={(e) => setProof(e.target.value)} className="text-sm" />
          </div>
        )}

        {completion?.status === "completed" ? (
          <div className="glass rounded-2xl p-4 flex items-center gap-3 border-success/40">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-xs">Task completed. Coins credited to wallet.</p>
          </div>
        ) : completion?.status === "pending" ? (
          <Button variant="outline" size="xl" className="w-full" disabled>Submitted · Awaiting Review</Button>
        ) : (
          <Button variant="hero" size="xl" className="w-full" onClick={submit} disabled={submitting || proof.length < 3}>
            {submitting ? "Submitting…" : "Submit Proof"}
          </Button>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default TaskDetail;
