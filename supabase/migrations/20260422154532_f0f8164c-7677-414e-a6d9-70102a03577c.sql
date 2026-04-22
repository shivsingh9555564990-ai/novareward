
CREATE OR REPLACE FUNCTION public.complete_quiz(p_score integer, p_total integer DEFAULT 10, p_category text DEFAULT 'Mixed'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_reward INTEGER;
  v_attempt_id UUID;
  v_already INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_total NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'invalid total'; END IF;
  IF p_score < 0 OR p_score > p_total THEN RAISE EXCEPTION 'invalid score'; END IF;

  -- Daily 1-attempt limit (Asia/Kolkata)
  SELECT COUNT(*) INTO v_already FROM public.quiz_attempts
    WHERE user_id = v_user_id
      AND ((created_at AT TIME ZONE 'Asia/Kolkata')::date) = v_today;
  IF v_already >= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_played_today');
  END IF;

  -- 1 NC per correct answer
  v_reward := p_score;

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
