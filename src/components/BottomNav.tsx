import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import iconHome from "@/assets/icon-home.png";
import iconEarn from "@/assets/icon-earn.png";
import iconWallet from "@/assets/icon-wallet.png";
import iconRedeem from "@/assets/icon-redeem.png";
import iconLeaderboard from "@/assets/icon-leaderboard.png";

const tabs = [
  { to: "/home", icon: iconHome, label: "Home" },
  { to: "/earn", icon: iconEarn, label: "Earn" },
  { to: "/wallet", icon: iconWallet, label: "Wallet" },
  { to: "/redeem", icon: iconRedeem, label: "Redeem" },
  { to: "/leaderboard", icon: iconLeaderboard, label: "Ranks" },
];

const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2">
      <div className="glass mx-auto flex max-w-md items-center justify-between rounded-3xl px-2 py-2 shadow-elevated">
        {tabs.map(({ to, icon, label }) => {
          const active = pathname === to;
          return (
            <NavLink key={to} to={to} className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl transition-bounce",
                  active ? "bg-gradient-primary shadow-glow" : "bg-transparent"
                )}
              >
                <img
                  src={icon}
                  alt={label}
                  className={cn("h-6 w-6 object-contain", !active && "opacity-50 grayscale")}
                  width={24}
                  height={24}
                />
              </div>
              <span className={cn("text-[10px] font-semibold tracking-wide", active ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              {active && <span className="absolute -top-1 h-1 w-8 rounded-full bg-gradient-neon shadow-neon" />}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
