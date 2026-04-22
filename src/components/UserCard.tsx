import { Link } from "react-router-dom";
import { Coins, UserCheck, UserPlus, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UserSummary = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  coins: number;
  friends_count?: number;
  followers_count?: number;
  is_friend?: boolean;
  is_following?: boolean;
  request_outgoing?: boolean;
  request_incoming?: boolean;
  incoming_request_id?: string | null;
};

type Props = {
  user: UserSummary;
  index?: number;
  onAddFriend?: (id: string) => void;
  onCancelRequest?: (id: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onFollow?: (id: string) => void;
  onUnfollow?: (id: string) => void;
  primary?: "friend" | "follow"; // which CTA stays prominent
  busy?: boolean;
};

const Avatar = ({ name, src, size = "h-12 w-12 text-base" }: { name: string; src: string | null; size?: string }) => {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  if (src && src.startsWith("http")) {
    return (
      <img src={src} alt={name} className={cn(size, "rounded-full object-cover border-2 border-primary/30")} loading="lazy" />
    );
  }
  // emoji or single char
  return (
    <div className={cn(size, "rounded-full bg-gradient-primary p-[2px] shadow-glow")}>
      <div className="flex h-full w-full items-center justify-center rounded-full bg-background font-bold">
        {src && !src.startsWith("http") ? src : initial}
      </div>
    </div>
  );
};

export const UserCard = ({
  user, index = 0, onAddFriend, onCancelRequest, onAcceptRequest,
  onFollow, onUnfollow, primary = "friend", busy = false,
}: Props) => {
  const friendCTA = () => {
    if (user.is_friend) {
      return <Button size="sm" variant="outline" disabled className="gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Friends</Button>;
    }
    if (user.request_incoming && user.incoming_request_id) {
      return (
        <Button size="sm" variant="hero" disabled={busy}
          onClick={(e) => { e.preventDefault(); onAcceptRequest?.(user.incoming_request_id!); }}
          className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Accept
        </Button>
      );
    }
    if (user.request_outgoing) {
      return (
        <Button size="sm" variant="outline" disabled={busy}
          onClick={(e) => { e.preventDefault(); onCancelRequest?.(user.user_id); }}
          className="gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Pending
        </Button>
      );
    }
    return (
      <Button size="sm" variant="hero" disabled={busy}
        onClick={(e) => { e.preventDefault(); onAddFriend?.(user.user_id); }}
        className="gap-1.5">
        <UserPlus className="h-3.5 w-3.5" /> Add
      </Button>
    );
  };

  const followCTA = () => {
    if (user.is_following) {
      return (
        <Button size="sm" variant="outline" disabled={busy}
          onClick={(e) => { e.preventDefault(); onUnfollow?.(user.user_id); }}>
          Following
        </Button>
      );
    }
    return (
      <Button size="sm" variant="outline" disabled={busy}
        onClick={(e) => { e.preventDefault(); onFollow?.(user.user_id); }}>
        Follow
      </Button>
    );
  };

  return (
    <Link
      to={`/u/${user.user_id}`}
      className="glass relative flex items-center gap-3 rounded-2xl p-3 animate-slide-up active:scale-[0.99] transition-bounce hover:shadow-glow"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <Avatar name={user.name} src={user.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{user.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-coin" />{user.coins.toLocaleString()}</span>
          {typeof user.friends_count === "number" && (
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{user.friends_count}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {primary === "friend" ? friendCTA() : followCTA()}
        {primary === "friend" && !user.is_friend && !user.request_incoming && !user.request_outgoing && (
          <button
            onClick={(e) => { e.preventDefault(); user.is_following ? onUnfollow?.(user.user_id) : onFollow?.(user.user_id); }}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-accent"
          >
            {user.is_following ? "Unfollow" : "Follow"}
          </button>
        )}
      </div>
    </Link>
  );
};

export { Avatar };
