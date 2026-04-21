
-- Redemption requests table
CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('upi','giftcard')),
  brand TEXT,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  coins_spent INTEGER NOT NULL CHECK (coins_spent > 0),
  upi_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redemptions" ON public.redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own redemptions" ON public.redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Atomic redemption: validates balance, debits coins, inserts redemption + transaction
CREATE OR REPLACE FUNCTION public.create_redemption(
  p_type TEXT,
  p_brand TEXT,
  p_amount_inr INTEGER,
  p_upi_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_coins INTEGER;
  v_required INTEGER;
  v_redemption_id UUID;
  v_min_inr INTEGER := 10;
  v_max_inr INTEGER := 10000;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_type NOT IN ('upi','giftcard') THEN RAISE EXCEPTION 'invalid type'; END IF;
  IF p_amount_inr < v_min_inr OR p_amount_inr > v_max_inr THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF p_type = 'upi' AND (p_upi_id IS NULL OR length(p_upi_id) < 4) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_upi');
  END IF;
  IF p_type = 'giftcard' AND (p_brand IS NULL OR length(p_brand) < 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_brand');
  END IF;

  v_required := p_amount_inr * 12; -- 120 NC = 10 INR

  SELECT coins INTO v_coins FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF v_coins IS NULL OR v_coins < v_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins', 'required', v_required, 'have', COALESCE(v_coins, 0));
  END IF;

  INSERT INTO public.redemptions (user_id, type, brand, amount_inr, coins_spent, upi_id, status)
  VALUES (v_user_id, p_type, p_brand, p_amount_inr, v_required, p_upi_id, 'pending')
  RETURNING id INTO v_redemption_id;

  PERFORM public.credit_user_coins(
    v_user_id, -v_required, 'redeem',
    CASE WHEN p_type = 'upi' THEN 'upi_withdrawal' ELSE 'giftcard:' || p_brand END,
    'redeem:' || v_redemption_id::text,
    jsonb_build_object('redemption_id', v_redemption_id, 'amount_inr', p_amount_inr)
  );

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id, 'amount_inr', p_amount_inr, 'coins_spent', v_required);
END;
$$;
