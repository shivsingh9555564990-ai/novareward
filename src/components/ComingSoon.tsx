import BottomNav from "@/components/BottomNav";
import { Sparkles } from "lucide-react";

const ComingSoon = ({ title, desc }: { title: string; desc: string }) => (
  <div className="relative min-h-screen pb-28 overflow-hidden flex flex-col items-center justify-center px-6 text-center">
    <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
    <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
    <div className="pointer-events-none absolute bottom-20 -right-10 h-64 w-64 rounded-full bg-secondary/25 blur-3xl" />

    <div className="relative z-10 max-w-sm">
      <div className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse-glow">
        <Sparkles className="h-9 w-9 text-primary-foreground" />
      </div>
      <h1 className="text-3xl font-extrabold text-gradient-primary mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-semibold">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        Activating in next phase
      </div>
    </div>
    <BottomNav />
  </div>
);

export default ComingSoon;
