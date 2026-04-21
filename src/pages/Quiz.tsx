import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Brain, CheckCircle2, Clock, Share2, Trophy, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Question = {
  id: string;
  category: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

const TIME_PER_Q = 20;
const TOTAL_Q = 10;

const Quiz = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [done, setDone] = useState(false);
  const [reward, setReward] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("quiz_questions").select("*").eq("is_active", true).limit(50);
      const all = (data ?? []) as any[];
      const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, TOTAL_Q);
      setQuestions(shuffled.map((q) => ({ ...q, options: Array.isArray(q.options) ? q.options : JSON.parse(q.options) })));
      setLoading(false);
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (loading || submitted || done) return;
    if (timeLeft <= 0) { handleSubmit(null); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, loading, submitted, done]);

  const current = questions[idx];

  const handleSubmit = (choice: number | null) => {
    if (submitted) return;
    setSubmitted(true);
    if (choice !== null && current && choice === current.correct_index) {
      setScore((s) => s + 1);
    }
  };

  const next = async () => {
    if (idx + 1 >= questions.length) {
      // finish
      const finalScore = score;
      const { data, error } = await supabase.rpc("complete_quiz", {
        p_score: finalScore,
        p_total: TOTAL_Q,
        p_category: "Mixed",
      });
      if (error) toast.error("Could not save quiz");
      else {
        const r = (data as any)?.reward ?? 0;
        setReward(r);
      }
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
    setTimeLeft(TIME_PER_Q);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (questions.length === 0) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><p>No questions available.</p><Button onClick={() => navigate("/games")}>Back</Button></div>;
  }

  if (done) {
    const pct = Math.round((score / TOTAL_Q) * 100);
    return (
      <div className="relative min-h-screen pb-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="h-24 w-24 rounded-full bg-gradient-primary p-[3px] shadow-glow animate-pulse-glow">
            <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
              <Trophy className="h-10 w-10 text-coin" />
            </div>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold text-gradient-neon">Quiz Complete!</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pct >= 70 ? "🔥 Brilliant!" : pct >= 40 ? "👍 Good try!" : "Keep going!"}</p>

          <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</p>
              <p className="mt-1 text-3xl font-extrabold">{score}/{TOTAL_Q}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reward</p>
              <p className="mt-1 text-3xl font-extrabold text-gradient-coin">+{reward}</p>
            </div>
          </div>

          <div className="mt-3 w-full max-w-sm glass rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Coins earned</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Correct × 10 NC</span>
              <span className="font-bold text-gradient-coin">+{score * 10} NC</span>
            </div>
            {score >= 10 && (
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Perfect bonus</span>
                <span className="font-bold text-success">capped at 100</span>
              </div>
            )}
          </div>

          <div className="mt-6 w-full max-w-sm space-y-2">
            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/wallet")}>
              View Wallet
            </Button>
            <Button variant="outline" size="lg" className="w-full" onClick={() => {
              if (navigator.share) navigator.share({ title: "NovaRewards Quiz", text: `I scored ${score}/${TOTAL_Q} on NovaRewards Quiz!` });
              else { navigator.clipboard.writeText(`I scored ${score}/${TOTAL_Q} on NovaRewards!`); toast.success("Copied!"); }
            }}>
              <Share2 className="h-4 w-4" /> Share Score
            </Button>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate("/games")}>Back to Games</Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-28 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <header className="relative px-5 pt-8 flex items-center gap-3">
        <button onClick={() => navigate("/games")} className="rounded-full bg-muted/60 p-2"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-[0.3em] text-accent flex items-center gap-1"><Brain className="h-3 w-3" /> Quiz</p>
          <p className="text-sm font-bold">Question {idx + 1} of {TOTAL_Q}</p>
        </div>
        <div className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums", timeLeft <= 5 ? "bg-destructive/20 text-destructive animate-pulse" : "bg-accent/15 text-accent")}>
          <Clock className="h-3.5 w-3.5" /> {timeLeft}s
        </div>
      </header>

      <div className="px-5 mt-3">
        <Progress value={((idx + 1) / TOTAL_Q) * 100} className="h-1.5" />
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Score: <span className="font-bold text-coin">{score}</span></span>
          <span>{current.category}</span>
        </div>
      </div>

      <main className="relative z-10 px-5 mt-5 space-y-4">
        <div className="glass rounded-3xl p-5 min-h-[120px] flex items-center">
          <h2 className="text-lg font-extrabold leading-snug">{current.question}</h2>
        </div>

        <div className="space-y-2.5">
          {current.options.map((opt, i) => {
            const isCorrect = i === current.correct_index;
            const isPicked = i === selected;
            const showCorrect = submitted && isCorrect;
            const showWrong = submitted && isPicked && !isCorrect;
            return (
              <button
                key={i}
                disabled={submitted}
                onClick={() => setSelected(i)}
                className={cn(
                  "w-full glass rounded-2xl p-4 text-left flex items-center gap-3 transition-bounce active:scale-[0.99]",
                  !submitted && isPicked && "border-primary shadow-glow",
                  showCorrect && "bg-success/15 border-success",
                  showWrong && "bg-destructive/15 border-destructive",
                )}
              >
                <span className={cn("h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold",
                  showCorrect ? "bg-success text-success-foreground" :
                  showWrong ? "bg-destructive text-destructive-foreground" :
                  isPicked ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {showCorrect ? <CheckCircle2 className="h-4 w-4" /> : showWrong ? <XCircle className="h-4 w-4" /> : String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium">{opt}</span>
              </button>
            );
          })}
        </div>

        {submitted && current.explanation && (
          <div className="glass rounded-2xl p-4 border-accent/30 animate-slide-up">
            <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Explanation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{current.explanation}</p>
          </div>
        )}

        {!submitted ? (
          <Button variant="hero" size="xl" className="w-full" disabled={selected === null} onClick={() => handleSubmit(selected)}>
            Submit Answer
          </Button>
        ) : (
          <Button variant="hero" size="xl" className="w-full" onClick={next}>
            {idx + 1 >= TOTAL_Q ? "See Results" : "Next Question →"}
          </Button>
        )}
      </main>
    </div>
  );
};

export default Quiz;
