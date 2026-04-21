-- Transactions ledger
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('survey','spin','scratch','daily_bonus','task','referral','redeem','adjustment')),
  source TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'credited' CHECK (status IN ('pending','credited','reversed','failed')),
  reference_id TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_tx_source_ref ON public.transactions(source, reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX idx_tx_user_created ON public.transactions(user_id, created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Daily activity tracking (spin/scratch/bonus per day per user)
CREATE TABLE public.daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity TEXT NOT NULL CHECK (activity IN ('spin','scratch','daily_bonus')),
  activity_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  reward INTEGER NOT NULL DEFAULT 0,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity, activity_date)
);
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "da_select_own" ON public.daily_activity FOR SELECT USING (auth.uid() = user_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'system',
  read_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Atomic credit function (used by edge functions with service role)
CREATE OR REPLACE FUNCTION public.credit_user_coins(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_source TEXT,
  p_reference_id TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount cannot be zero';
  END IF;

  -- Idempotency: if reference already exists, return existing tx
  IF p_reference_id IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions
      WHERE source = p_source AND reference_id = p_reference_id LIMIT 1;
    IF v_tx_id IS NOT NULL THEN
      RETURN v_tx_id;
    END IF;
  END IF;

  INSERT INTO public.transactions (user_id, type, source, amount, reference_id, meta, status)
  VALUES (p_user_id, p_type, p_source, p_amount, p_reference_id, p_meta, 'credited')
  RETURNING id INTO v_tx_id;

  UPDATE public.profiles
    SET coins = GREATEST(0, coins + p_amount), updated_at = now()
    WHERE id = p_user_id;

  INSERT INTO public.notifications (user_id, title, body, type, meta)
  VALUES (
    p_user_id,
    CASE WHEN p_amount > 0 THEN '🎉 +' || p_amount || ' Nova Coins credited' ELSE p_amount || ' Nova Coins debited' END,
    'Source: ' || p_source,
    'reward',
    jsonb_build_object('tx_id', v_tx_id, 'amount', p_amount)
  );

  RETURN v_tx_id;
END;
$$;

-- Daily activity claim (atomic, prevents duplicate same-day claims)
CREATE OR REPLACE FUNCTION public.claim_daily_activity(
  p_activity TEXT,
  p_reward INTEGER,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_tx_id UUID;
  v_activity_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_reward <= 0 OR p_reward > 5000 THEN
    RAISE EXCEPTION 'invalid reward';
  END IF;
  IF p_activity NOT IN ('spin','scratch','daily_bonus') THEN
    RAISE EXCEPTION 'invalid activity';
  END IF;

  -- Insert daily activity (UNIQUE constraint prevents double-claim)
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

  RETURN jsonb_build_object('success', true, 'tx_id', v_tx_id, 'reward', p_reward);
END;
$$;
