-- Sponsored offers table for the Earn page
CREATE TABLE public.sponsored_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_url TEXT NOT NULL,
  reward INTEGER NOT NULL DEFAULT 25,
  duration_label TEXT DEFAULT '~30s',
  badge_label TEXT DEFAULT 'Sponsored',
  badge_emoji TEXT DEFAULT '🔥',
  animation_style TEXT NOT NULL DEFAULT 'aurora',
  -- one of: aurora | neon | sunset | ocean | gold | matrix
  accent_color TEXT DEFAULT 'primary',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsored_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsored_read_auth"
ON public.sponsored_offers
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER sponsored_offers_set_updated_at
BEFORE UPDATE ON public.sponsored_offers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Seed with several sponsor offers (all currently point to same Monetag link;
-- can be edited later from backend)
INSERT INTO public.sponsored_offers (title, subtitle, cta_url, reward, duration_label, badge_label, badge_emoji, animation_style, sort_order) VALUES
('Visit Sponsor & Earn Instantly', 'Tap to open partner offer · Stay 30s · Reward auto-credits', 'https://omg10.com/4/10910510', 25, '~30s', 'Featured', '🔥', 'aurora', 1),
('Mega Bonus Partner Offer', 'Quick visit · Huge reward · Limited slots today', 'https://omg10.com/4/10910510', 35, '~45s', 'Hot Deal', '⚡', 'neon', 2),
('Daily Sponsor Spotlight', 'Discover new app · Earn coins instantly', 'https://omg10.com/4/10910510', 20, '~20s', 'New', '✨', 'sunset', 3),
('Premium Partner Reward', 'Exclusive offer · Higher payout · Tap now', 'https://omg10.com/4/10910510', 50, '~60s', 'VIP', '👑', 'gold', 4);