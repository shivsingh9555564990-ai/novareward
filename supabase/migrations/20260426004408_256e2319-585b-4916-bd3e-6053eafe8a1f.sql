
CREATE OR REPLACE FUNCTION public.admin_recent_transactions(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, email text, full_name text,
  type text, source text, amount integer, status text,
  reference_id text, meta jsonb, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_admin();
  RETURN QUERY
  SELECT t.id, t.user_id, au.email, p.full_name,
         t.type, t.source, t.amount, t.status,
         t.reference_id, t.meta, t.created_at
    FROM public.transactions t
    LEFT JOIN auth.users au ON au.id = t.user_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
   ORDER BY t.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
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
  SELECT p.id, au.email, COALESCE(NULLIF(p.full_name,''),'(no name)'),
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
  SELECT p.id, au.email, COALESCE(NULLIF(p.full_name,''),'(no name)'),
         p.coins, p.is_banned, p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
   ORDER BY p.coins DESC
   LIMIT GREATEST(1, LEAST(p_limit, 200));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_title text,
  p_body text,
  p_target text DEFAULT 'all',
  p_user_ids uuid[] DEFAULT NULL,
  p_type text DEFAULT 'system'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public._require_admin();
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'title_required');
  END IF;

  IF p_target = 'list' THEN
    IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_users');
    END IF;
    INSERT INTO public.notifications (user_id, title, body, type, meta)
    SELECT u, p_title, p_body, p_type, jsonb_build_object('broadcast', true)
      FROM unnest(p_user_ids) u;
  ELSIF p_target = 'banned' THEN
    INSERT INTO public.notifications (user_id, title, body, type, meta)
    SELECT id, p_title, p_body, p_type, jsonb_build_object('broadcast', true)
      FROM public.profiles WHERE is_banned = true;
  ELSIF p_target = 'active' THEN
    INSERT INTO public.notifications (user_id, title, body, type, meta)
    SELECT id, p_title, p_body, p_type, jsonb_build_object('broadcast', true)
      FROM public.profiles WHERE is_banned = false;
  ELSE
    INSERT INTO public.notifications (user_id, title, body, type, meta)
    SELECT id, p_title, p_body, p_type, jsonb_build_object('broadcast', true)
      FROM public.profiles;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'sent', v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  PERFORM public._require_admin();
  SELECT jsonb_build_object(
    'users_total',         (SELECT COUNT(*) FROM public.profiles),
    'users_banned',        (SELECT COUNT(*) FROM public.profiles WHERE is_banned),
    'users_suspicious',    (SELECT COUNT(*) FROM public.profiles WHERE is_suspicious),
    'users_today',         (SELECT COUNT(*) FROM public.profiles WHERE ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today),
    'pending_redemptions', (SELECT COUNT(*) FROM public.redemptions WHERE status = 'pending'),
    'pending_inr',         (SELECT COALESCE(SUM(amount_inr),0) FROM public.redemptions WHERE status = 'pending'),
    'paid_total_inr',      (SELECT COALESCE(SUM(amount_inr),0) FROM public.redemptions WHERE status = 'paid'),
    'paid_today_inr',      (SELECT COALESCE(SUM(amount_inr),0) FROM public.redemptions WHERE status = 'paid' AND ((updated_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today),
    'coins_in_circulation',(SELECT COALESCE(SUM(coins),0) FROM public.profiles),
    'coins_earned_today',  (SELECT COALESCE(SUM(amount),0) FROM public.transactions WHERE amount > 0 AND status = 'credited' AND ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today),
    'coins_spent_today',   (SELECT COALESCE(SUM(-amount),0) FROM public.transactions WHERE amount < 0 AND status = 'credited' AND ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today),
    'transactions_total',  (SELECT COUNT(*) FROM public.transactions),
    'transactions_today',  (SELECT COUNT(*) FROM public.transactions WHERE ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today),
    'redemptions_total',   (SELECT COUNT(*) FROM public.redemptions),
    'referrals_total',     (SELECT COUNT(*) FROM public.referrals),
    'referrals_credited',  (SELECT COUNT(*) FROM public.referrals WHERE status = 'credited'),
    'game_plays_today',    (SELECT COUNT(*) FROM public.game_plays WHERE play_date = v_today),
    'quiz_today',          (SELECT COUNT(*) FROM public.quiz_attempts WHERE ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today)
  ) INTO v;
  RETURN v;
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
  SELECT r.id, r.referrer_id, au1.email, p1.full_name,
         r.referred_user_id, au2.email, p2.full_name,
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
  SELECT g.id, g.user_id, au.email, p.full_name,
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
  SELECT q.id, q.user_id, au.email, p.full_name,
         q.score, q.total, q.reward, q.category, q.created_at
    FROM public.quiz_attempts q
    LEFT JOIN auth.users au ON au.id = q.user_id
    LEFT JOIN public.profiles p ON p.id = q.user_id
   ORDER BY q.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_coins(p_user_id uuid, p_target_balance integer, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current integer; v_diff integer; v_tx uuid; v_admin uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF p_target_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'negative_balance');
  END IF;
  SELECT coins INTO v_current FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  v_diff := p_target_balance - v_current;
  IF v_diff = 0 THEN
    RETURN jsonb_build_object('success', true, 'no_change', true);
  END IF;
  v_tx := public.credit_user_coins(
    p_user_id, v_diff, 'admin_adjust',
    CASE WHEN v_diff > 0 THEN 'admin_set_credit' ELSE 'admin_set_debit' END,
    'admin_set:' || v_admin::text || ':' || extract(epoch from now())::text,
    jsonb_build_object('note', p_note, 'admin_id', v_admin, 'target', p_target_balance, 'previous', v_current)
  );
  RETURN jsonb_build_object('success', true, 'tx_id', v_tx, 'diff', v_diff);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_notification(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  PERFORM public._require_admin();
  DELETE FROM public.notifications WHERE id = p_notification_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('success', v_n > 0);
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
  SELECT n.id, n.user_id, au.email, p.full_name,
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
  SELECT pm.id, pm.user_id, au.email, p.full_name,
         pm.kind, pm.upi_vpa, pm.bank_name, pm.account_holder,
         pm.account_number, pm.ifsc_code, pm.nickname,
         pm.is_default, pm.is_verified, pm.created_at
    FROM public.payment_methods pm
    LEFT JOIN auth.users au ON au.id = pm.user_id
    LEFT JOIN public.profiles p ON p.id = pm.user_id
   ORDER BY pm.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 500));
END; $$;
