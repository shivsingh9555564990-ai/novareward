-- 1. Payment methods (UPI / Bank) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('upi', 'bank')),
  -- UPI fields
  upi_vpa TEXT,
  -- Bank fields
  bank_name TEXT,
  account_holder TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  -- Common
  nickname TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_user ON public.payment_methods (user_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_select_own" ON public.payment_methods
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "pm_insert_own" ON public.payment_methods
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pm_update_own" ON public.payment_methods
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "pm_delete_own" ON public.payment_methods
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER pm_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic "set default" — clears any other default for this user.
CREATE OR REPLACE FUNCTION public.set_default_payment_method(p_method_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE id = p_method_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  UPDATE public.payment_methods SET is_default = false WHERE user_id = v_uid AND is_default = true;
  UPDATE public.payment_methods SET is_default = true WHERE id = p_method_id AND user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. User preferences (sound, notif categories) -------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  notif_rewards BOOLEAN NOT NULL DEFAULT true,
  notif_social BOOLEAN NOT NULL DEFAULT true,
  notif_system BOOLEAN NOT NULL DEFAULT true,
  notif_marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "up_select_own" ON public.user_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "up_insert_own" ON public.user_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "up_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER up_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Soft delete on profiles -------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Allow users to update their notifications (delete handled via update; or grant DELETE)
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Account soft-delete RPCs ------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.profiles
     SET deletion_requested_at = now(), updated_at = now()
   WHERE id = v_uid;
  RETURN jsonb_build_object(
    'success', true,
    'purge_after', (now() + interval '30 days')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.profiles
     SET deletion_requested_at = NULL, updated_at = now()
   WHERE id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Mark notifications read helpers -----------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.notifications SET read_at = now()
    WHERE user_id = v_uid AND read_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_n);
END;
$$;