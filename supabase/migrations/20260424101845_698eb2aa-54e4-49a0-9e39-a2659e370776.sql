-- ============================================================
-- 1. ROLES SYSTEM (security-definer pattern, no recursion)
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "ur_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. PROFILE FLAGS
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS test_withdrawal_used BOOLEAN NOT NULL DEFAULT false;

-- Allow admins to read every profile
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all transactions / redemptions for the panel
DROP POLICY IF EXISTS "admin_select_all_tx" ON public.transactions;
CREATE POLICY "admin_select_all_tx" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin_select_all_redemptions" ON public.redemptions;
CREATE POLICY "admin_select_all_redemptions" ON public.redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. AUTO-PROMOTE THE HARDCODED ADMIN EMAIL ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Hardcoded admin auto-promote
  IF NEW.email IS NOT NULL AND lower(NEW.email) = 'shivsingh9555564990@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Promote NOW if the admin account already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'shivsingh9555564990@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 4. BAN-AWARE CREDIT FUNCTION
--    (banned users cannot earn; admin-issued credits bypass via p_force)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_user_coins(
  p_user_id UUID, p_amount INTEGER, p_type TEXT, p_source TEXT,
  p_reference_id TEXT, p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx_id UUID;
  v_banned BOOLEAN;
BEGIN
  IF p_amount = 0 THEN RAISE EXCEPTION 'amount cannot be zero'; END IF;

  -- Block earnings for banned users (admin manual adjustments use admin_adjust_coins which bypasses)
  SELECT is_banned INTO v_banned FROM public.profiles WHERE id = p_user_id;
  IF v_banned AND p_amount > 0 AND p_type NOT IN ('admin_adjust') THEN
    RAISE EXCEPTION 'user_banned';
  END IF;

  IF p_reference_id IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.transactions
      WHERE source = p_source AND reference_id = p_reference_id LIMIT 1;
    IF v_tx_id IS NOT NULL THEN RETURN v_tx_id; END IF;
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
    'Source: ' || p_source, 'reward',
    jsonb_build_object('tx_id', v_tx_id, 'amount', p_amount)
  );

  RETURN v_tx_id;
END;
$$;

-- ============================================================
-- 5. WITHDRAWAL: ₹2 ONE-TIME TEST + BAN CHECK
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_redemption(
  p_type TEXT, p_brand TEXT, p_amount_inr INTEGER, p_upi_id TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_coins INTEGER;
  v_required INTEGER;
  v_redemption_id UUID;
  v_min_inr INTEGER := 10;
  v_max_inr INTEGER := 10000;
  v_is_test BOOLEAN := false;
  v_banned BOOLEAN;
  v_test_used BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_type NOT IN ('upi','giftcard') THEN RAISE EXCEPTION 'invalid type'; END IF;

  SELECT is_banned, test_withdrawal_used
    INTO v_banned, v_test_used
    FROM public.profiles WHERE id = v_user_id;

  IF v_banned THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_banned');
  END IF;

  -- ₹2 test path: UPI only, lifetime once per user
  IF p_type = 'upi' AND p_amount_inr = 2 AND NOT v_test_used THEN
    v_is_test := true;
  ELSIF p_amount_inr < v_min_inr OR p_amount_inr > v_max_inr THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  IF p_type = 'upi' AND (p_upi_id IS NULL OR length(p_upi_id) < 4) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_upi');
  END IF;
  IF p_type = 'giftcard' AND (p_brand IS NULL OR length(p_brand) < 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_brand');
  END IF;

  v_required := p_amount_inr * 12;

  SELECT coins INTO v_coins FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF v_coins IS NULL OR v_coins < v_required THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_coins',
      'required', v_required, 'have', COALESCE(v_coins, 0));
  END IF;

  INSERT INTO public.redemptions (user_id, type, brand, amount_inr, coins_spent, upi_id, status, meta)
  VALUES (v_user_id, p_type, p_brand, p_amount_inr, v_required, p_upi_id, 'pending',
    CASE WHEN v_is_test THEN jsonb_build_object('test_withdrawal', true) ELSE '{}'::jsonb END)
  RETURNING id INTO v_redemption_id;

  PERFORM public.credit_user_coins(
    v_user_id, -v_required, 'redeem',
    CASE WHEN p_type = 'upi' THEN 'upi_withdrawal' ELSE 'giftcard:' || p_brand END,
    'redeem:' || v_redemption_id::text,
    jsonb_build_object('redemption_id', v_redemption_id, 'amount_inr', p_amount_inr, 'test', v_is_test)
  );

  IF v_is_test THEN
    UPDATE public.profiles SET test_withdrawal_used = true, updated_at = now()
      WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id,
    'amount_inr', p_amount_inr, 'coins_spent', v_required, 'test_withdrawal', v_is_test);
END;
$$;

-- ============================================================
-- 6. ADMIN HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden_admin_only';
  END IF;
END;
$$;

-- 6a. Search users
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query TEXT, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  user_id UUID, email TEXT, full_name TEXT, coins INTEGER,
  is_banned BOOLEAN, is_suspicious BOOLEAN, test_withdrawal_used BOOLEAN,
  created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q TEXT := lower(trim(coalesce(p_query, '')));
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT p.id, au.email, COALESCE(NULLIF(p.full_name,''),'(no name)'),
         p.coins, p.is_banned, p.is_suspicious, p.test_withdrawal_used,
         p.created_at, au.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   WHERE v_q = ''
      OR lower(coalesce(au.email,'')) LIKE '%'||v_q||'%'
      OR lower(coalesce(p.full_name,'')) LIKE '%'||v_q||'%'
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

-- 6b. User detail (profile + counters)
CREATE OR REPLACE FUNCTION public.admin_get_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p RECORD; v_email TEXT; v_total_earned INTEGER; v_total_spent INTEGER;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO v_p FROM public.profiles WHERE id = p_user_id;
  IF v_p.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  SELECT COALESCE(SUM(amount),0) INTO v_total_earned FROM public.transactions
    WHERE user_id = p_user_id AND amount > 0 AND status = 'credited';
  SELECT COALESCE(SUM(-amount),0) INTO v_total_spent FROM public.transactions
    WHERE user_id = p_user_id AND amount < 0 AND status = 'credited';
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_p.id, 'email', v_email, 'full_name', v_p.full_name,
      'coins', v_p.coins, 'is_banned', v_p.is_banned, 'is_suspicious', v_p.is_suspicious,
      'ban_reason', v_p.ban_reason, 'test_withdrawal_used', v_p.test_withdrawal_used,
      'created_at', v_p.created_at,
      'total_earned', v_total_earned, 'total_spent', v_total_spent
    )
  );
END;
$$;

-- 6c. List a user's transactions
CREATE OR REPLACE FUNCTION public.admin_list_user_transactions(p_user_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE(id UUID, type TEXT, source TEXT, amount INTEGER, status TEXT, reference_id TEXT, meta JSONB, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY SELECT t.id, t.type, t.source, t.amount, t.status, t.reference_id, t.meta, t.created_at
    FROM public.transactions t
    WHERE t.user_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

-- 6d. Ban / unban
CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user_id UUID, p_banned BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  UPDATE public.profiles
     SET is_banned = p_banned,
         ban_reason = CASE WHEN p_banned THEN p_reason ELSE NULL END,
         updated_at = now()
   WHERE id = p_user_id;
  INSERT INTO public.notifications (user_id, title, body, type, meta)
  VALUES (p_user_id,
    CASE WHEN p_banned THEN '⛔ Account banned' ELSE '✅ Account unbanned' END,
    COALESCE(p_reason, 'Contact support for details.'), 'system',
    jsonb_build_object('banned', p_banned));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6e. Suspicious flag
CREATE OR REPLACE FUNCTION public.admin_set_suspicious(p_user_id UUID, p_flag BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  UPDATE public.profiles SET is_suspicious = p_flag, updated_at = now() WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6f. Manual coin credit / debit
CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user_id UUID, p_amount INTEGER, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx UUID; v_admin UUID := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF p_amount = 0 THEN RETURN jsonb_build_object('success', false, 'error','amount_zero'); END IF;
  v_tx := public.credit_user_coins(
    p_user_id, p_amount, 'admin_adjust',
    CASE WHEN p_amount > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
    'admin:' || v_admin::text || ':' || extract(epoch from now())::text,
    jsonb_build_object('note', p_note, 'admin_id', v_admin)
  );
  RETURN jsonb_build_object('success', true, 'tx_id', v_tx);
END;
$$;

-- 6g. Reverse a transaction (reject earning) — refunds the original credit
CREATE OR REPLACE FUNCTION public.admin_reverse_transaction(p_tx_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx RECORD; v_new_tx UUID;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id FOR UPDATE;
  IF v_tx.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;
  IF v_tx.status = 'reversed' THEN RETURN jsonb_build_object('success', false, 'error','already_reversed'); END IF;
  IF v_tx.amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error','only_credits_reversible'); END IF;

  -- Insert reversing entry
  INSERT INTO public.transactions (user_id, type, source, amount, reference_id, meta, status)
  VALUES (v_tx.user_id, 'reversal', 'admin_reject:' || v_tx.source,
          -v_tx.amount, 'reverse:' || p_tx_id::text,
          jsonb_build_object('original_tx', p_tx_id, 'reason', p_reason),
          'credited')
  RETURNING id INTO v_new_tx;

  UPDATE public.profiles
     SET coins = GREATEST(0, coins - v_tx.amount), updated_at = now()
   WHERE id = v_tx.user_id;

  UPDATE public.transactions SET status = 'reversed' WHERE id = p_tx_id;

  INSERT INTO public.notifications (user_id, title, body, type, meta)
  VALUES (v_tx.user_id, '⚠️ Earning rejected',
    COALESCE(p_reason, 'An earning was reversed by admin review.'),
    'system', jsonb_build_object('tx_id', p_tx_id, 'amount', -v_tx.amount));

  RETURN jsonb_build_object('success', true, 'reversal_tx', v_new_tx);
END;
$$;

-- 6h. Withdrawal queue
CREATE OR REPLACE FUNCTION public.admin_list_redemptions(p_status TEXT DEFAULT 'pending', p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
  id UUID, user_id UUID, email TEXT, full_name TEXT,
  type TEXT, brand TEXT, amount_inr INTEGER, coins_spent INTEGER,
  upi_id TEXT, status TEXT, meta JSONB, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT r.id, r.user_id, au.email, p.full_name, r.type, r.brand,
         r.amount_inr, r.coins_spent, r.upi_id, r.status, r.meta, r.created_at
    FROM public.redemptions r
    LEFT JOIN auth.users au ON au.id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
   WHERE p_status IS NULL OR p_status = '' OR r.status = p_status
   ORDER BY r.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

-- 6i. Update redemption status
CREATE OR REPLACE FUNCTION public.admin_update_redemption(
  p_redemption_id UUID, p_action TEXT, p_utr TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r RECORD;
BEGIN
  PERFORM public._require_admin();
  IF p_action NOT IN ('approve','reject','paid','unpaid') THEN
    RETURN jsonb_build_object('success', false, 'error','invalid_action');
  END IF;

  SELECT * INTO v_r FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF v_r.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error','not_found'); END IF;

  IF p_action = 'reject' THEN
    IF v_r.status IN ('rejected','paid') THEN
      RETURN jsonb_build_object('success', false, 'error','already_finalised');
    END IF;
    UPDATE public.redemptions
       SET status = 'rejected',
           meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('reject_note', p_note),
           updated_at = now()
     WHERE id = p_redemption_id;
    -- Refund coins
    PERFORM public.credit_user_coins(
      v_r.user_id, v_r.coins_spent, 'refund', 'redeem_refund',
      'refund:' || p_redemption_id::text,
      jsonb_build_object('redemption_id', p_redemption_id, 'reason', p_note)
    );
    -- If it was a test withdrawal, allow them to try again
    IF (v_r.meta ->> 'test_withdrawal') = 'true' THEN
      UPDATE public.profiles SET test_withdrawal_used = false WHERE id = v_r.user_id;
    END IF;

  ELSIF p_action = 'approve' THEN
    UPDATE public.redemptions SET status = 'approved', updated_at = now() WHERE id = p_redemption_id;
  ELSIF p_action = 'paid' THEN
    UPDATE public.redemptions
       SET status = 'paid', delivered_at = now(),
           meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('utr', p_utr, 'paid_note', p_note),
           updated_at = now()
     WHERE id = p_redemption_id;
    INSERT INTO public.notifications (user_id, title, body, type, meta)
    VALUES (v_r.user_id, '💸 Withdrawal paid',
      '₹' || v_r.amount_inr || ' sent. UTR: ' || COALESCE(p_utr,'-'), 'reward',
      jsonb_build_object('redemption_id', p_redemption_id, 'utr', p_utr));
  ELSIF p_action = 'unpaid' THEN
    UPDATE public.redemptions SET status = 'approved', delivered_at = NULL, updated_at = now()
     WHERE id = p_redemption_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6j. Stats summary for admin dashboard
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  PERFORM public._require_admin();
  SELECT jsonb_build_object(
    'users_total', (SELECT COUNT(*) FROM public.profiles),
    'users_banned', (SELECT COUNT(*) FROM public.profiles WHERE is_banned),
    'users_suspicious', (SELECT COUNT(*) FROM public.profiles WHERE is_suspicious),
    'pending_redemptions', (SELECT COUNT(*) FROM public.redemptions WHERE status = 'pending'),
    'paid_total_inr', (SELECT COALESCE(SUM(amount_inr),0) FROM public.redemptions WHERE status = 'paid'),
    'coins_in_circulation', (SELECT COALESCE(SUM(coins),0) FROM public.profiles)
  ) INTO v;
  RETURN v;
END;
$$;
