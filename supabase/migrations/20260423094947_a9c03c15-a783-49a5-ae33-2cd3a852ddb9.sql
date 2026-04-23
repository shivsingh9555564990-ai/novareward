-- 1. Fix transactions.type check constraint to allow 'game' and 'quiz'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type = ANY (ARRAY[
    'survey'::text, 'spin'::text, 'scratch'::text, 'daily_bonus'::text,
    'task'::text, 'referral'::text, 'redeem'::text, 'adjustment'::text,
    'game'::text, 'quiz'::text
  ]));

-- 2. Update play_game: lucky_dice = 1 play/day, reward capped 1..5 based on score (sum of two dice 2..12 -> 1..5)
CREATE OR REPLACE FUNCTION public.play_game(p_game text, p_score integer, p_device_fp text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_count INTEGER;
  v_device_count INTEGER;
  v_play_id UUID;
  v_reward INTEGER := 1;
  v_daily_limit INTEGER := 5;
  v_device_daily_limit INTEGER := 15;
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

  -- Per-game daily limit: lucky_dice = 1, others = 5
  IF p_game = 'lucky_dice' THEN
    v_daily_limit := 1;
    -- Reward = score/2 capped 1..5 (score is sum of two dice = 2..12)
    v_reward := GREATEST(1, LEAST(5, p_score / 2));
  ELSE
    v_daily_limit := 5;
    v_reward := 1;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.game_plays
    WHERE user_id = v_user_id AND game = p_game AND play_date = v_today;
  IF v_count >= v_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit_reached',
      'limit', v_daily_limit, 'played', v_count);
  END IF;

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

  PERFORM public.credit_referral_on_first_earn(v_user_id);

  RETURN jsonb_build_object('success', true, 'reward', v_reward,
    'remaining', v_daily_limit - v_count - 1, 'play_id', v_play_id);
END;
$function$;

-- 3. Device signups tracking table
CREATE TABLE IF NOT EXISTS public.device_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fp TEXT NOT NULL,
  user_id UUID NOT NULL,
  email_hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_fp, user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_signups_fp ON public.device_signups (device_fp);

ALTER TABLE public.device_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ds_select_own" ON public.device_signups
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Public RPC: check if device already has any account (returns masked email hint).
-- SECURITY DEFINER so unauthenticated users can probe before signup.
CREATE OR REPLACE FUNCTION public.check_device_signup(p_device_fp text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count INTEGER; v_hint TEXT;
BEGIN
  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  SELECT COUNT(*), MAX(email_hint) INTO v_count, v_hint
    FROM public.device_signups WHERE device_fp = p_device_fp;
  RETURN jsonb_build_object(
    'exists', v_count > 0,
    'count', v_count,
    'email_hint', v_hint
  );
END;
$function$;

-- Authenticated RPC: register device after signup (called from app on first login)
CREATE OR REPLACE FUNCTION public.register_device_signup(p_device_fp text, p_email_hint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_device_fp IS NULL OR length(p_device_fp) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_device');
  END IF;
  INSERT INTO public.device_signups (device_fp, user_id, email_hint)
  VALUES (p_device_fp, v_uid, p_email_hint)
  ON CONFLICT (device_fp, user_id) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$function$;