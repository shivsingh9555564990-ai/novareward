import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Flag, Sparkles, Users, Zap, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Offer = {
  id: string;
  kind: string;
  provider: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  reward_min: number;
  reward_max: number;
  duration_min: number | null;
  completion_rate: number | null;
  requirements: string[];
  cta_url: string | null;
};

const SurveyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("offers").select("*").eq("id", id!).maybeSingle();
      setOffer(data as any);
      setLoading(false);
    })();
  }, [id]);

  const start = async () => {
    if (!offer) return;
    if (offer.cta_url) {
      window.open(offer.cta_url, "_blank");
      return;
    }
    toast.info("Survey provider integration pending. Coins will credit via postback once live.");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!offer) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>Survey not found</p><Button onClick={() => navigate("/earn")}>Back</Button></div>;

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />

      <header className="relative h-56 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute left-4 top-8 z-10 rounded-full bg-background/60 p-2 backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
        <div className="absolute bottom-4 left-5 right-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/40 backdrop-blur px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            <Sparkles className="h-3 w-3" /> {offer.category ?? "Survey"} · {offer.provider}
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-primary-foreground leading-tight">{offer.title}</h1>
          {offer.subtitle && <p className="text-sm text-primary-foreground/80">{offer.subtitle}</p>}
        </div>
      </header>

      <main className="relative z-10 px-5 -mt-3 space-y-4">
        {/* Reward banner */}
        <div className="glass rounded-3xl p-5 text-center shadow-glow">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You earn</p>
          <p className="mt-1 text-5xl font-extrabold text-gradient-coin">
            {offer.reward_min === offer.reward_max ? offer.reward_max : `${offer.reward_min}–${offer.reward_max}`}
          </p>
          <p className="text-xs text-muted-foreground">Nova Coins · credited instantly</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Clock className="h-4 w-4" />} label="Time" value={offer.duration_min ? `~${offer.duration_min}m` : "—"} />
          <Stat icon={<Users className="h-4 w-4" />} label="Complete" value={offer.completion_rate ? `${offer.completion_rate}%` : "—"} />
          <Stat icon={<Zap className="h-4 w-4" />} label="Type" value={offer.kind} />
        </div>

        {offer.description && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">About this survey</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{offer.description}</p>
          </div>
        )}

        {offer.requirements?.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3">Requirements</h3>
            <ul className="space-y-2">
              {offer.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-bold mb-2">Payment</h3>
          <p className="text-xs text-muted-foreground">Coins credited automatically once provider confirms completion (1–5 mins). Track in <Link to="/transactions" className="text-accent">Transactions</Link>.</p>
        </div>

        <div className="space-y-2 pt-2">
          <Button variant="hero" size="xl" className="w-full" onClick={start}>
            Start Survey {offer.cta_url && <ExternalLink className="h-4 w-4" />}
          </Button>
          <button className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-2"
            onClick={() => toast.success("Reported. Our team will review.")}>
            <Flag className="h-3 w-3" /> Report Survey
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="glass rounded-2xl p-3 text-center">
    <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">{icon}</div>
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-sm font-bold capitalize">{value}</p>
  </div>
);

export default SurveyDetail;
