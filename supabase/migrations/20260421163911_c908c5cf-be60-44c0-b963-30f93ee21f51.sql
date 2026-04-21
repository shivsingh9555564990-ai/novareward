
-- ============ OFFERS (surveys / tasks / games) ============
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('survey','task','game')),
  provider TEXT NOT NULL DEFAULT 'internal',
  external_id TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  category TEXT,
  reward_min INTEGER NOT NULL DEFAULT 0,
  reward_max INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  completion_rate NUMERIC(4,1),
  requirements JSONB DEFAULT '[]'::jsonb,
  steps JSONB DEFAULT '[]'::jsonb,
  cta_url TEXT,
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offers_kind_active ON public.offers(kind, is_active);
CREATE INDEX IF NOT EXISTS idx_offers_created ON public.offers(created_at DESC);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_read_authenticated" ON public.offers
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE TRIGGER offers_set_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ OFFER COMPLETIONS ============
CREATE TABLE IF NOT EXISTS public.offer_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
  reward_credited INTEGER NOT NULL DEFAULT 0,
  proof JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, offer_id)
);
ALTER TABLE public.offer_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_select_own" ON public.offer_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER oc_set_updated_at BEFORE UPDATE ON public.offer_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ QUIZ QUESTIONS ============
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- ["A","B","C","D"]
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_q_read_auth" ON public.quiz_questions
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- ============ QUIZ ATTEMPTS ============
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 10,
  reward INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_select_own" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "qa_insert_own" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ GIFT CARD BRANDS ============
CREATE TABLE IF NOT EXISTS public.gift_card_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  logo_url TEXT,
  description TEXT,
  denominations INTEGER[] NOT NULL DEFAULT ARRAY[100,250,500,1000]::int[],
  min_inr INTEGER NOT NULL DEFAULT 100,
  max_inr INTEGER NOT NULL DEFAULT 5000,
  delivery_methods TEXT[] NOT NULL DEFAULT ARRAY['email']::text[],
  terms TEXT,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_card_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gcb_read_auth" ON public.gift_card_brands
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE TRIGGER gcb_set_updated_at BEFORE UPDATE ON public.gift_card_brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ VOUCHER CODES (pool) ============
CREATE TABLE IF NOT EXISTS public.voucher_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,
  amount_inr INTEGER NOT NULL,
  code TEXT NOT NULL,
  pin TEXT,
  expires_at TIMESTAMPTZ,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_user_id UUID,
  redemption_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vc_pool ON public.voucher_codes(brand_slug, amount_inr, is_used);
ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vc_select_own" ON public.voucher_codes
  FOR SELECT TO authenticated USING (assigned_user_id = auth.uid());

-- ============ REDEMPTIONS extras ============
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS voucher_pin TEXT,
  ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ============ Seed: gift card brands (25 popular Indian brands) ============
INSERT INTO public.gift_card_brands (slug, name, category, emoji, color, denominations, min_inr, max_inr, is_popular, sort_order, description) VALUES
('amazon','Amazon','Shopping','🛒','from-amber-500 to-orange-600',ARRAY[100,250,500,1000,2000,5000],100,5000,TRUE,1,'Shop millions of products on Amazon India.'),
('flipkart','Flipkart','Shopping','🛍️','from-blue-500 to-indigo-600',ARRAY[100,250,500,1000,2000],100,5000,TRUE,2,'India''s leading e-commerce destination.'),
('myntra','Myntra','Fashion','👗','from-pink-500 to-rose-600',ARRAY[250,500,1000,2000],250,5000,TRUE,3,'Top fashion & lifestyle brands.'),
('nykaa','Nykaa','Beauty','💄','from-rose-400 to-pink-600',ARRAY[250,500,1000,2000],250,5000,TRUE,4,'Beauty, makeup & personal care.'),
('swiggy','Swiggy','Food','🛵','from-orange-500 to-red-500',ARRAY[100,250,500,1000],100,2000,TRUE,5,'Food delivery from your favorite restaurants.'),
('zomato','Zomato','Food','🍕','from-red-500 to-pink-600',ARRAY[100,250,500,1000],100,2000,TRUE,6,'Order food & dining vouchers.'),
('bigbasket','BigBasket','Grocery','🥬','from-emerald-600 to-green-700',ARRAY[250,500,1000,2000],250,5000,TRUE,7,'Online grocery & daily essentials.'),
('bookmyshow','BookMyShow','Entertainment','🎬','from-red-500 to-rose-600',ARRAY[100,250,500,1000],100,2000,TRUE,8,'Movies, events & live shows.'),
('netflix','Netflix','Entertainment','📺','from-red-600 to-rose-700',ARRAY[500,1000],500,2000,TRUE,9,'Streaming subscription gift.'),
('spotify','Spotify','Entertainment','🎵','from-emerald-500 to-green-600',ARRAY[200,500,1000],200,2000,FALSE,10,'Music streaming subscription.'),
('google-play','Google Play','Gaming','▶️','from-blue-500 to-green-500',ARRAY[100,250,500,1000,2000],100,5000,TRUE,11,'Apps, games & in-app purchases.'),
('app-store','App Store & iTunes','Gaming','🍎','from-blue-500 to-cyan-500',ARRAY[500,1000,2000],500,5000,FALSE,12,'Apple App Store & iTunes credit.'),
('uber','Uber','Travel','🚗','from-slate-700 to-zinc-800',ARRAY[250,500,1000],250,5000,FALSE,13,'Rides anywhere, anytime.'),
('makemytrip','MakeMyTrip','Travel','✈️','from-red-500 to-orange-500',ARRAY[500,1000,2000,5000],500,10000,FALSE,14,'Flights, hotels & holidays.'),
('jio','Jio Recharge','Telecom','📶','from-blue-600 to-indigo-700',ARRAY[100,250,500],100,2000,FALSE,15,'Mobile recharge for Jio.'),
('airtel','Airtel Recharge','Telecom','📱','from-red-600 to-rose-700',ARRAY[100,250,500],100,2000,FALSE,16,'Mobile recharge for Airtel.'),
('dominos','Domino''s Pizza','Food','🍕','from-blue-600 to-red-600',ARRAY[100,250,500],100,2000,FALSE,17,'Hot pizza vouchers.'),
('starbucks','Starbucks','Food','☕','from-emerald-700 to-green-800',ARRAY[250,500,1000],250,2000,FALSE,18,'Coffee & beverages.'),
('mcdonalds','McDonald''s','Food','🍔','from-yellow-500 to-red-600',ARRAY[100,250,500],100,2000,FALSE,19,'Burgers & fast food.'),
('decathlon','Decathlon','Shopping','⚽','from-blue-700 to-cyan-700',ARRAY[500,1000,2000],500,5000,FALSE,20,'Sports & outdoor gear.'),
('lifestyle','Lifestyle','Fashion','👚','from-purple-500 to-pink-600',ARRAY[250,500,1000],250,5000,FALSE,21,'Fashion department store.'),
('shoppers-stop','Shoppers Stop','Fashion','🛍️','from-rose-500 to-red-600',ARRAY[250,500,1000,2000],250,5000,FALSE,22,'Premium fashion retail.'),
('croma','Croma','Shopping','📺','from-emerald-500 to-teal-600',ARRAY[500,1000,2000],500,10000,FALSE,23,'Electronics & appliances.'),
('1mg','Tata 1mg','Beauty','💊','from-orange-500 to-red-500',ARRAY[100,250,500],100,2000,FALSE,24,'Medicines & health products.'),
('blinkit','Blinkit','Grocery','⚡','from-yellow-500 to-amber-600',ARRAY[100,250,500],100,2000,FALSE,25,'10-minute grocery delivery.')
ON CONFLICT (slug) DO NOTHING;

-- ============ Seed: quiz questions (30 across categories) ============
INSERT INTO public.quiz_questions (category, question, options, correct_index, explanation, difficulty) VALUES
('Geography','What is the capital of Australia?', '["Sydney","Canberra","Melbourne","Perth"]'::jsonb, 1, 'Canberra is the capital — Sydney is the largest city.', 1),
('Geography','Which is the longest river in the world?', '["Amazon","Nile","Yangtze","Mississippi"]'::jsonb, 1, 'The Nile is approximately 6,650 km long.', 1),
('Geography','Mount Everest lies on the border of Nepal and which country?', '["India","China","Bhutan","Tibet"]'::jsonb, 1, 'Everest sits on the Nepal–China (Tibet) border.', 2),
('Geography','Which Indian state has the longest coastline?', '["Tamil Nadu","Kerala","Gujarat","Andhra Pradesh"]'::jsonb, 2, 'Gujarat has India''s longest coastline (~1,600 km).', 2),
('Tech','Who founded Microsoft?', '["Steve Jobs","Bill Gates","Mark Zuckerberg","Larry Page"]'::jsonb, 1, 'Bill Gates co-founded Microsoft with Paul Allen in 1975.', 1),
('Tech','What does CPU stand for?', '["Central Processing Unit","Computer Personal Unit","Central Program Utility","Core Power Unit"]'::jsonb, 0, 'CPU = Central Processing Unit.', 1),
('Tech','Which company makes the iPhone?', '["Samsung","Google","Apple","OnePlus"]'::jsonb, 2, 'Apple Inc. designs and sells the iPhone.', 1),
('Tech','HTML stands for?', '["Hyper Text Markup Language","High Tech Modern Lang","Hyperlink Text Mode Lang","Home Tool Markup Lang"]'::jsonb, 0, 'HTML = Hyper Text Markup Language.', 1),
('Tech','Which language runs in a web browser natively?', '["Python","Java","C++","JavaScript"]'::jsonb, 3, 'JavaScript is the native browser language.', 2),
('Tech','Founder of Tesla and SpaceX?', '["Jeff Bezos","Elon Musk","Larry Ellison","Tim Cook"]'::jsonb, 1, 'Elon Musk founded SpaceX and leads Tesla.', 1),
('Sports','How many players in a cricket team?', '["9","10","11","12"]'::jsonb, 2, 'A cricket team fields 11 players.', 1),
('Sports','Who has the most international centuries?', '["Virat Kohli","Sachin Tendulkar","Ricky Ponting","Brian Lara"]'::jsonb, 1, 'Sachin Tendulkar holds 100 international centuries.', 2),
('Sports','FIFA World Cup is held every how many years?', '["2","3","4","5"]'::jsonb, 2, 'The FIFA World Cup is every 4 years.', 1),
('Sports','Which country won the 2023 ICC Cricket World Cup?', '["India","Australia","England","New Zealand"]'::jsonb, 1, 'Australia won the 2023 ODI World Cup in Ahmedabad.', 2),
('Science','What planet is known as the Red Planet?', '["Venus","Mars","Jupiter","Mercury"]'::jsonb, 1, 'Mars appears red due to iron oxide on its surface.', 1),
('Science','H2O is the chemical formula for?', '["Salt","Water","Oxygen","Hydrogen"]'::jsonb, 1, 'H2O = water.', 1),
('Science','How many bones are in the adult human body?', '["186","206","226","246"]'::jsonb, 1, 'Adults have 206 bones.', 2),
('Science','The speed of light is approximately?', '["3×10^5 km/s","3×10^8 m/s","3×10^6 m/s","3×10^7 m/s"]'::jsonb, 1, 'c ≈ 299,792,458 m/s ≈ 3×10^8 m/s.', 3),
('Bollywood','Who is known as the King of Bollywood?', '["Salman Khan","Aamir Khan","Shah Rukh Khan","Hrithik Roshan"]'::jsonb, 2, 'Shah Rukh Khan is widely called the King of Bollywood.', 1),
('Bollywood','Which film won India''s first Oscar for Best Original Song?', '["Lagaan","Slumdog Millionaire","RRR","3 Idiots"]'::jsonb, 2, 'Naatu Naatu from RRR won Best Original Song in 2023.', 2),
('History','Who was the first Prime Minister of India?', '["Mahatma Gandhi","Jawaharlal Nehru","Sardar Patel","B.R. Ambedkar"]'::jsonb, 1, 'Jawaharlal Nehru served from 1947 to 1964.', 1),
('History','In which year did India gain independence?', '["1945","1946","1947","1950"]'::jsonb, 2, 'India became independent on August 15, 1947.', 1),
('History','Who built the Taj Mahal?', '["Akbar","Shah Jahan","Aurangzeb","Babur"]'::jsonb, 1, 'Shah Jahan built it in memory of Mumtaz Mahal.', 1),
('Math','What is 15% of 200?', '["20","25","30","35"]'::jsonb, 2, '15% of 200 = 30.', 1),
('Math','The square root of 144 is?', '["10","11","12","14"]'::jsonb, 2, '12 × 12 = 144.', 1),
('Math','Sum of angles in a triangle?', '["90°","180°","270°","360°"]'::jsonb, 1, 'Always 180° in Euclidean geometry.', 1),
('GK','Currency of Japan?', '["Won","Yen","Yuan","Ringgit"]'::jsonb, 1, 'Japanese Yen (¥).', 1),
('GK','Largest ocean on Earth?', '["Atlantic","Indian","Arctic","Pacific"]'::jsonb, 3, 'Pacific is the largest and deepest.', 1),
('GK','Which gas do plants absorb from the atmosphere?', '["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"]'::jsonb, 2, 'Plants take in CO₂ for photosynthesis.', 1),
('GK','National animal of India?', '["Lion","Tiger","Elephant","Peacock"]'::jsonb, 1, 'Bengal Tiger is the national animal.', 1)
ON CONFLICT DO NOTHING;

-- ============ Seed: a few internal offers (so Earn Hub has real data before CPX/BitLabs) ============
INSERT INTO public.offers (kind, provider, title, subtitle, description, category, reward_min, reward_max, duration_min, difficulty, completion_rate, requirements, steps, sort_order)
VALUES
('survey','internal','Tech & Gadget Habits 2026','Quick consumer panel','Share your views on smartphones, wearables and AI tools. Helps brands design better products.','Technology',180,240,6,1,82.0,
  '["Age 16+","India resident","Honest answers"]'::jsonb,
  '["Tap Start Survey","Answer 12 quick questions","Submit & get coins instantly"]'::jsonb, 1),
('survey','internal','Food Delivery Experience','Swiggy & Zomato users','Tell us about your last 3 food orders to help improve delivery quality.','Lifestyle',120,180,4,1,88.0,
  '["Used food delivery in last 30 days"]'::jsonb,
  '["Open survey","Rate your last 3 orders","Submit"]'::jsonb, 2),
('survey','internal','Travel Plans 2026','Domestic & international','Help us understand post-pandemic travel preferences.','Travel',280,360,9,2,74.0,
  '["Age 18+"]'::jsonb,
  '["Answer travel questions","Submit"]'::jsonb, 3),
('survey','internal','Streaming & Entertainment','OTT users','Share your OTT usage patterns.','Media',90,120,3,1,90.0,
  '["Use any OTT platform"]'::jsonb,
  '["Open survey","Submit honest answers"]'::jsonb, 4),
('task','internal','Install & Try Beta App','5-min hands-on task','Install a partner beta app, open it, and complete the welcome flow. Submit a screenshot as proof.','Mobile',300,300,5,2,70.0,
  '["Android device","Stable internet"]'::jsonb,
  '["Tap link to install","Open the app","Complete onboarding","Submit screenshot proof"]'::jsonb, 5),
('task','internal','Follow on Instagram','30-second social task','Follow our official Instagram handle @novarewards.','Social',50,50,1,1,95.0,
  '["Active Instagram account"]'::jsonb,
  '["Open Instagram link","Tap Follow","Submit your handle"]'::jsonb, 6),
('task','internal','Refer a Friend','Earn per signup','Invite a friend who completes signup and 1 activity.','Referral',200,200,2,2,60.0,
  '["Friend must be new"]'::jsonb,
  '["Share your referral link","Friend signs up","Friend completes 1 task"]'::jsonb, 7),
('game','internal','Daily Quiz','10 questions • Up to 100 NC','Answer 10 multiple-choice questions across mixed categories.','Quiz',10,100,3,2,NULL,
  '[]'::jsonb, '["Pick category","Answer 10 questions","See rewards"]'::jsonb, 8),
('game','internal','Spin the Wheel','1–5 NC daily','Spin once a day for instant Nova Coins.','Casual',1,5,1,1,NULL,
  '[]'::jsonb, '["Open Spin","Tap to spin"]'::jsonb, 9),
('game','internal','Scratch Card','1–3 NC daily','Reveal a hidden card to win Nova Coins.','Casual',1,3,1,1,NULL,
  '[]'::jsonb, '["Open Scratch","Scratch to reveal"]'::jsonb, 10);

-- ============ RPC: complete quiz and credit reward ============
CREATE OR REPLACE FUNCTION public.complete_quiz(p_score integer, p_total integer DEFAULT 10, p_category text DEFAULT 'Mixed')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward INTEGER;
  v_attempt_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_total NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid total'; END IF;
  IF p_score < 0 OR p_score > p_total THEN RAISE EXCEPTION 'invalid score'; END IF;

  -- 10 NC per correct answer, max 100 NC
  v_reward := LEAST(p_score * 10, 100);

  INSERT INTO public.quiz_attempts (user_id, score, total, reward, category)
  VALUES (v_user_id, p_score, p_total, v_reward, p_category)
  RETURNING id INTO v_attempt_id;

  IF v_reward > 0 THEN
    PERFORM public.credit_user_coins(
      v_user_id, v_reward, 'quiz', 'quiz_game',
      'quiz:' || v_attempt_id::text,
      jsonb_build_object('attempt_id', v_attempt_id, 'score', p_score, 'total', p_total, 'category', p_category)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'attempt_id', v_attempt_id, 'reward', v_reward, 'score', p_score, 'total', p_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_quiz(integer, integer, text) TO authenticated;
