import { ReactNode } from "react";
import { Coins } from "lucide-react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  back?: string;
}

export const AuthLayout = ({ children, title, subtitle, showLogo = true, back }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col px-6 pt-12 pb-8 max-w-md mx-auto w-full">
        {back && (
          <Link to={back} className="text-sm text-muted-foreground hover:text-foreground mb-6 self-start">
            ← Back
          </Link>
        )}

        {showLogo && (
          <div className="flex items-center gap-2 mb-8 animate-slide-up">
            <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Coins className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-gradient-primary">CoinBazaar</span>
          </div>
        )}

        <div className="mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
