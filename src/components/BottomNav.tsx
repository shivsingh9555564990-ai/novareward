import { NavLink, useLocation } from "react-router-dom";
import { Home, Zap, Wallet, Gift, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/earn", icon: Zap, label: "Earn" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/redeem", icon: Gift, label: "Redeem" },
  { to: "/leaderboard", icon: Trophy, label: "Ranks" },
];

const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2"
    >
      <div className="glass mx-auto flex max-w-md items-center justify-between rounded-3xl px-2 py-2 shadow-elevated">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl transition-bounce",
                  active
                    ? "bg-gradient-primary shadow-glow"
                    : "bg-transparent text-muted-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  )}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {active && (
                <span className="absolute -top-1 h-1 w-8 rounded-full bg-gradient-neon shadow-neon" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
