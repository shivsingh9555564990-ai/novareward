import { ReactNode } from "react";
import { Link } from "react-router-dom";
import novaLogo from "@/assets/nova-logo.png";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  back?: string;
}

export const AuthLayout = ({ children, title, subtitle, showLogo = true, back }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-bg grid-bg flex flex-col relative overflow-hidden">
      {/* Decorative neon blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/2 -left-32 w-96 h-96 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col px-6 pt-10 pb-8 max-w-md mx-auto w-full">
        {back && (
          <Link to={back} className="text-sm text-muted-foreground hover:text-primary mb-6 self-start transition-smooth">
            ← Back
          </Link>
        )}

        {showLogo && (
          <div className="flex items-center gap-3 mb-8 animate-slide-up">
            <img
              src={novaLogo}
              alt="NovaReward"
              width={44}
              height={44}
              className="w-11 h-11 rounded-2xl shadow-glow"
            />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-extrabold">
                <span className="text-foreground">Nova</span>
                <span className="text-success">Reward</span>
              </span>
              <span className="text-[10px] text-primary/70 font-mono tracking-widest">// v3.0</span>
            </div>
          </div>
        )}

        <div className="mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h1 className="text-3xl font-bold mb-2 text-gradient-neon">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="animate-slide-up glass rounded-3xl p-6 shadow-elevated" style={{ animationDelay: "0.2s" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
