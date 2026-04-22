
-- ============ REFERRAL CODES ============
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rc_select_own" ON public.referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

-- ============ REFERRALS ============
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  code_used TEXT NOT NULL,
  device_fp TEXT,
  ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | credited | rejected
  referrer_reward INTEGER NOT NULL DEFAULT 50,
  referred_reward INTEGER NOT NULL DEFAULT 25,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_select_referrer" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_device_fp ON public.referrals(device_fp);

-- ============ GAME PLAYS ============
CREATE TABLE public.game_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  game TEXT NOT NULL, -- 'tap_coin' | 'memory_match' | 'lucky_dice'
  reward INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  device_fp TEXT,
  play_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gp_select_own" ON public.game_plays
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_game_plays_user_date ON public.game_plays(user_id, game, play_date);
CREATE INDEX idx_game_plays_device ON public.game_plays(device_fp, play_date);

-- ============ HELPER: generate code ============
CREATE OR REPLACE FUNCTION public.gen_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ============ AUTO-CREATE referral code on profile creation ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempts INTEGER := 0;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );

  -- Generate unique referral code
  LOOP
    v_code := public.gen_referral_code();
    BEGIN
      INSERT INTO public.referral_codes (user_id, code) VALUES (NEW.id, v_code);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique referral code';
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users (recreate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill referral codes for existing users
INSERT INTO public.referral_codes (user_id, code)
SELECT p.id, public.gen_referral_code()
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.id
WHERE rc.id IS NULL
ON CONFLICT DO NOTHING;

-- ============ APPLY REFERRAL CODE ============
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT, p_device_fp TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_referrer_id UUID;
  v_existing UUID;
  v_device_used UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_code IS NULL OR length(trim(p_code)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;
  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_device');
  END IF;

  -- Find referrer
  SELECT user_id INTO v_referrer_id FROM public.referral_codes
    WHERE code = upper(trim(p_code)) LIMIT 1;
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_not_found');
  END IF;

  -- No self-referral
  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_referral');
  END IF;

  -- Already referred?
  SELECT id INTO v_existing FROM public.referrals WHERE referred_user_id = v_user_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_referred');
  END IF;

  -- Device fingerprint check: this device must not have been used for any prior referral
  SELECT id INTO v_device_used FROM public.referrals
    WHERE device_fp = p_device_fp LIMIT 1;
  IF v_device_used IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'device_already_used');
  END IF;

  -- Also: referred user must not have any prior earnings/transactions (anti-abuse)
  IF EXISTS (SELECT 1 FROM public.transactions WHERE user_id = v_user_id LIMIT 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_not_new');
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_user_id, code_used, device_fp, status)
  VALUES (v_referrer_id, v_user_id, upper(trim(p_code)), p_device_fp, 'pending');

  RETURN jsonb_build_object('success', true, 'message', 'Referral linked. Earn your first reward to unlock bonus.');
END;
$$;

-- ============ CREDIT REFERRAL ON FIRST EARN ============
CREATE OR REPLACE FUNCTION public.credit_referral_on_first_earn(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref RECORD;
BEGIN
  SELECT * INTO v_ref FROM public.referrals
    WHERE referred_user_id = p_user_id AND status = 'pending'
    LIMIT 1;
  IF v_ref.id IS NULL THEN RETURN; END IF;

  -- Credit referrer
  PERFORM public.credit_user_coins(
    v_ref.referrer_id, v_ref.referrer_reward, 'referral', 'referral_bonus',
    'referral:referrer:' || v_ref.id::text,
    jsonb_build_object('referral_id', v_ref.id, 'referred_user', p_user_id)
  );

  -- Credit referred (welcome)
  PERFORM public.credit_user_coins(
    p_user_id, v_ref.referred_reward, 'referral', 'referral_welcome',
    'referral:referred:' || v_ref.id::text,
    jsonb_build_object('referral_id', v_ref.id, 'referrer', v_ref.referrer_id)
  );

  UPDATE public.referrals
    SET status = 'credited', credited_at = now()
    WHERE id = v_ref.id;

  UPDATE public.referral_codes
    SET uses_count = uses_count + 1,
        total_earned = total_earned + v_ref.referrer_reward
    WHERE user_id = v_ref.referrer_id;
END;
$$;

-- ============ PLAY GAME (1 NC, max 5/day per game, device-checked) ============
CREATE OR REPLACE FUNCTION public.play_game(p_game TEXT, p_score INTEGER, p_device_fp TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count INTEGER;
  v_device_count INTEGER;
  v_play_id UUID;
  v_reward INTEGER := 1;
  v_daily_limit INTEGER := 5;
  v_device_daily_limit INTEGER := 15; -- across all games per device
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_game NOT IN ('tap_coin', 'memory_match', 'lucky_dice') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_game');
  END IF;
  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_device');
  END IF;
  IF p_score < 0 OR p_score > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_score');
  END IF;

  -- Per-user-per-game daily limit
  SELECT COUNT(*) INTO v_count FROM public.game_plays
    WHERE user_id = v_user_id AND game = p_game AND play_date = v_today;
  IF v_count >= v_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached',
      'limit', v_daily_limit, 'played', v_count);
  END IF;

  -- Per-device-per-day cap (across ALL games) — anti multi-account abuse
  SELECT COUNT(*) INTO v_device_count FROM public.game_plays
    WHERE device_fp = p_device_fp AND play_date = v_today;
  IF v_device_count >= v_device_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'device_limit_reached');
  END IF;

  INSERT INTO public.game_plays (user_id, game, reward, score, device_fp)
  VALUES (v_user_id, p_game, v_reward, p_score, p_device_fp)
  RETURNING id INTO v_play_id;

  PERFORM public.credit_user_coins(
    v_user_id, v_reward, 'game', p_game,
    'game:' || v_play_id::text,
    jsonb_build_object('play_id', v_play_id, 'score', p_score)
  );

  -- Trigger referral credit if this was the first earn
  PERFORM public.credit_referral_on_first_earn(v_user_id);

  RETURN jsonb_build_object('success', true, 'reward', v_reward,
    'remaining', v_daily_limit - v_count - 1, 'play_id', v_play_id);
END;
$$;

-- Also trigger referral credit from existing earning paths
-- Wrap claim_daily_activity to call credit_referral
CREATE OR REPLACE FUNCTION public.claim_daily_activity(p_activity text, p_reward integer, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_tx_id UUID;
  v_activity_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_reward <= 0 OR p_reward > 5000 THEN RAISE EXCEPTION 'invalid reward'; END IF;
  IF p_activity NOT IN ('spin','scratch','daily_bonus') THEN RAISE EXCEPTION 'invalid activity'; END IF;

  BEGIN
    INSERT INTO public.daily_activity (user_id, activity, activity_date, reward, meta)
    VALUES (v_user_id, p_activity, v_today, p_reward, p_meta)
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed_today');
  END;

  v_tx_id := public.credit_user_coins(
    v_user_id, p_reward, p_activity, p_activity,
    p_activity || ':' || v_today::text, p_meta
  );

  -- Trigger referral credit
  PERFORM public.credit_referral_on_first_earn(v_user_id);

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'reward', p_reward);
END;
$function$;

-- Same for complete_quiz
CREATE OR REPLACE FUNCTION public.complete_quiz(p_score integer, p_total integer DEFAULT 10, p_category text DEFAULT 'Mixed'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_reward INTEGER;
  v_attempt_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_total NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid total'; END IF;
  IF p_score < 0 OR p_score > p_total THEN RAISE EXCEPTION 'invalid score'; END IF;

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
    PERFORM public.credit_referral_on_first_earn(v_user_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'attempt_id', v_attempt_id, 'reward', v_reward, 'score', p_score, 'total', p_total);
END;
$function$;
