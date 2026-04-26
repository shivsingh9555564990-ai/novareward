
-- ============ Fix type mismatches: cast au.email to text everywhere ============

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(
  user_id uuid, email text, full_name text, coins integer,
  is_banned boolean, is_suspicious boolean, test_withdrawal_used boolean,
  created_at timestamptz, last_sign_in_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_q TEXT := lower(trim(coalesce(p_query, ''))); v_total bigint;
BEGIN
  PERFORM public._require_admin();
  SELECT COUNT(*) INTO v_total
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   WHERE v_q = ''
      OR lower(coalesce(au.email::text,'')) LIKE '%'||v_q||'%'
      OR lower(coalesce(p.full_name,'')) LIKE '%'||v_q||'%';

  RETURN QUERY
  SELECT p.id, au.email::text, COALESCE(NULLIF(p.full_name,''),'(no name)'),
         p.coins, p.is_banned, p.is_suspicious, p.test_withdrawal_used,
         p.created_at, au.last_sign_in_at, v_total
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   WHERE v_q = ''
      OR lower(coalesce(au.email::text,'')) LIKE '%'||v_q||'%'
      OR lower(coalesce(p.full_name,'')) LIKE '%'||v_q||'%'
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 200))
   OFFSET GREATEST(0, p_offset);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_redemptions(p_status text DEFAULT 'pending', p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text, type text, brand text,
  amount_inr integer, coins_spent integer, upi_id text, status text,
  meta jsonb, created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint;
BEGIN
  PERFORM public._require_admin();
  SELECT COUNT(*) INTO v_total FROM public.redemptions r
   WHERE p_status IS NULL OR p_status = '' OR r.status = p_status;
  RETURN QUERY
  SELECT r.id, r.user_id, au.email::text, p.full_name, r.type, r.brand,
         r.amount_inr, r.coins_spent, r.upi_id, r.status, r.meta, r.created_at, v_total
    FROM public.redemptions r
    LEFT JOIN auth.users au ON au.id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
   WHERE p_status IS NULL OR p_status = '' OR r.status = p_status
   ORDER BY r.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500))
   OFFSET GREATEST(0, p_offset);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_recent_transactions(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_type text DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  type text, source text, amount integer, status text,
  reference_id text, meta jsonb, created_at timestamptz, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total bigint;
BEGIN
  PERFORM public._require_admin();
  SELECT COUNT(*) INTO v_total FROM public.transactions t
   WHERE p_type IS NULL OR p_type = '' OR t.type = p_type;
  RETURN QUERY
  SELECT t.id, t.user_id, au.email::text, p.full_name,
         t.type, t.source, t.amount, t.status,
         t.reference_id, t.meta, t.created_at, v_total
    FROM public.transactions t
    LEFT JOIN auth.users au ON au.id = t.user_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
   WHERE p_type IS NULL OR p_type = '' OR t.type = p_type
   ORDER BY t.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500))
   OFFSET GREATEST(0, p_offset);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_recent_signups(p_limit integer DEFAULT 50)
RETURNS TABLE(
  user_id uuid, email text, full_name text, coins integer,
  is_banned boolean, is_suspicious boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT p.id, au.email::text, COALESCE(NULLIF(p.full_name,''),'(no name)'),
         p.coins, p.is_banned, p.is_suspicious, p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   ORDER BY p.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 200));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_top_users(p_limit integer DEFAULT 50)
RETURNS TABLE(
  user_id uuid, email text, full_name text, coins integer,
  is_banned boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT p.id, au.email::text, COALESCE(NULLIF(p.full_name,''),'(no name)'),
         p.coins, p.is_banned, p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   ORDER BY p.coins DESC
   LIMIT GREATEST(1, LEAST(p_limit, 200));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_referrals(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, referrer_id uuid, referrer_email text, referrer_name text,
  referred_user_id uuid, referred_email text, referred_name text,
  code_used text, status text, device_fp text,
  referrer_reward integer, referred_reward integer,
  created_at timestamptz, credited_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT r.id, r.referrer_id, au1.email::text, p1.full_name,
         r.referred_user_id, au2.email::text, p2.full_name,
         r.code_used, r.status, r.device_fp,
         r.referrer_reward, r.referred_reward,
         r.created_at, r.credited_at
    FROM public.referrals r
    LEFT JOIN auth.users au1 ON au1.id = r.referrer_id
    LEFT JOIN public.profiles p1 ON p1.id = r.referrer_id
    LEFT JOIN auth.users au2 ON au2.id = r.referred_user_id
    LEFT JOIN public.profiles p2 ON p2.id = r.referred_user_id
   ORDER BY r.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_game_plays(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  game text, score integer, reward integer,
  device_fp text, play_date date, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT g.id, g.user_id, au.email::text, p.full_name,
         g.game, g.score, g.reward, g.device_fp, g.play_date, g.created_at
    FROM public.game_plays g
    LEFT JOIN auth.users au ON au.id = g.user_id
    LEFT JOIN public.profiles p ON p.id = g.user_id
   ORDER BY g.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_quiz_attempts(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  score integer, total integer, reward integer, category text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT q.id, q.user_id, au.email::text, p.full_name,
         q.score, q.total, q.reward, q.category, q.created_at
    FROM public.quiz_attempts q
    LEFT JOIN auth.users au ON au.id = q.user_id
    LEFT JOIN public.profiles p ON p.id = q.user_id
   ORDER BY q.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_notifications(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  title text, body text, type text, read_at timestamptz, created_at timestamptz, meta jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT n.id, n.user_id, au.email::text, p.full_name,
         n.title, n.body, n.type, n.read_at, n.created_at, n.meta
    FROM public.notifications n
    LEFT JOIN auth.users au ON au.id = n.user_id
    LEFT JOIN public.profiles p ON p.id = n.user_id
   ORDER BY n.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_payment_methods(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  kind text, upi_vpa text, bank_name text, account_holder text,
  account_number text, ifsc_code text, nickname text,
  is_default boolean, is_verified boolean, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT pm.id, pm.user_id, au.email::text, p.full_name,
         pm.kind, pm.upi_vpa, pm.bank_name, pm.account_holder,
         pm.account_number, pm.ifsc_code, pm.nickname,
         pm.is_default, pm.is_verified, pm.created_at
    FROM public.payment_methods pm
    LEFT JOIN auth.users au ON au.id = pm.user_id
    LEFT JOIN public.profiles p ON p.id = pm.user_id
   ORDER BY pm.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

-- ============ Bulk admin actions ============

CREATE OR REPLACE FUNCTION public.admin_bulk_set_ban(p_user_ids uuid[], p_banned boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public._require_admin();
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_users');
  END IF;
  UPDATE public.profiles
     SET is_banned = p_banned,
         ban_reason = CASE WHEN p_banned THEN COALESCE(p_reason, 'Bulk action') ELSE NULL END,
         updated_at = now()
   WHERE id = ANY(p_user_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.notifications (user_id, title, body, type, meta)
  SELECT u, CASE WHEN p_banned THEN '🚫 Account suspended' ELSE '✅ Account restored' END,
         COALESCE(p_reason, CASE WHEN p_banned THEN 'Your account has been suspended.' ELSE 'Your account is active again.' END),
         'system', jsonb_build_object('bulk', true)
    FROM unnest(p_user_ids) u;

  RETURN jsonb_build_object('success', true, 'updated', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_bulk_adjust_coins(p_user_ids uuid[], p_amount integer, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_count integer := 0; v_admin uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_users');
  END IF;
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'zero_amount');
  END IF;
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    BEGIN
      PERFORM public.credit_user_coins(
        v_uid, p_amount, 'admin_adjust',
        CASE WHEN p_amount > 0 THEN 'admin_bulk_credit' ELSE 'admin_bulk_debit' END,
        'admin_bulk:' || v_admin::text || ':' || v_uid::text || ':' || extract(epoch from now())::text,
        jsonb_build_object('note', p_note, 'admin_id', v_admin, 'bulk', true)
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- skip failures, continue
      NULL;
    END;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'updated', v_count);
END; $$;
