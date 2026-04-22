-- ============ ADD counter columns to profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friends_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- ============ FRIENDSHIPS ============
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendship_ordered CHECK (user_a < user_b),
  CONSTRAINT friendship_unique UNIQUE (user_a, user_b)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_friendships_a ON public.friendships(user_a);
CREATE INDEX idx_friendships_b ON public.friendships(user_b);
CREATE POLICY "fs_select_own" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============ FRIEND REQUESTS ============
CREATE TABLE public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT fr_no_self CHECK (sender_id <> receiver_id)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_fr_pending_unique
  ON public.friend_requests(sender_id, receiver_id) WHERE status = 'pending';
CREATE INDEX idx_fr_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX idx_fr_sender ON public.friend_requests(sender_id, status);
CREATE POLICY "fr_select_own" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============ FOLLOWS ============
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_no_self CHECK (follower_id <> following_id),
  CONSTRAINT follow_unique UNIQUE (follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE POLICY "fol_select_all" ON public.follows
  FOR SELECT TO authenticated USING (true);

-- ============ COUNTER TRIGGERS ============
CREATE OR REPLACE FUNCTION public.bump_friend_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET friends_count = friends_count + 1 WHERE id = NEW.user_a;
    UPDATE public.profiles SET friends_count = friends_count + 1 WHERE id = NEW.user_b;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = OLD.user_a;
    UPDATE public.profiles SET friends_count = GREATEST(0, friends_count - 1) WHERE id = OLD.user_b;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_friend_counters
  AFTER INSERT OR DELETE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.bump_friend_counters();

CREATE OR REPLACE FUNCTION public.bump_follow_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_follow_counters
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.bump_follow_counters();

-- ============ SEND FRIEND REQUEST ============
CREATE OR REPLACE FUNCTION public.send_friend_request(p_receiver UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_lo UUID; v_hi UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_receiver = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_request');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_receiver) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  v_lo := LEAST(v_uid, p_receiver);
  v_hi := GREATEST(v_uid, p_receiver);
  IF EXISTS (SELECT 1 FROM public.friendships WHERE user_a = v_lo AND user_b = v_hi) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_friends');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'pending'
      AND ((sender_id = v_uid AND receiver_id = p_receiver)
        OR (sender_id = p_receiver AND receiver_id = v_uid))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_exists');
  END IF;

  INSERT INTO public.friend_requests (sender_id, receiver_id) VALUES (v_uid, p_receiver);

  INSERT INTO public.notifications (user_id, title, body, type, meta)
  VALUES (p_receiver, '👋 New friend request',
    'You have a new friend request', 'social',
    jsonb_build_object('from', v_uid));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ ACCEPT ============
CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_req RECORD; v_lo UUID; v_hi UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_req FROM public.friend_requests
    WHERE id = p_request_id AND receiver_id = v_uid AND status = 'pending'
    FOR UPDATE;
  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  v_lo := LEAST(v_req.sender_id, v_req.receiver_id);
  v_hi := GREATEST(v_req.sender_id, v_req.receiver_id);
  INSERT INTO public.friendships (user_a, user_b) VALUES (v_lo, v_hi)
    ON CONFLICT (user_a, user_b) DO NOTHING;

  UPDATE public.friend_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = p_request_id;

  INSERT INTO public.notifications (user_id, title, body, type, meta)
  VALUES (v_req.sender_id, '🎉 Friend request accepted',
    'You are now friends', 'social',
    jsonb_build_object('with', v_uid));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ DECLINE / CANCEL / REMOVE ============
CREATE OR REPLACE FUNCTION public.decline_friend_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.friend_requests
    SET status = 'declined', responded_at = now()
    WHERE id = p_request_id AND receiver_id = v_uid AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('success', v_n > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.friend_requests
    SET status = 'cancelled', responded_at = now()
    WHERE id = p_request_id AND sender_id = v_uid AND status = 'pending';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('success', v_n > 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_other UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.friendships
    WHERE user_a = LEAST(v_uid, p_other) AND user_b = GREATEST(v_uid, p_other);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('success', v_n > 0);
END;
$$;

-- ============ FOLLOW / UNFOLLOW ============
CREATE OR REPLACE FUNCTION public.follow_user(p_target UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_target = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_follow');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  INSERT INTO public.follows (follower_id, following_id) VALUES (v_uid, p_target)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_user(p_target UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.follows WHERE follower_id = v_uid AND following_id = p_target;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============ SEARCH USERS ============
CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT, p_limit INTEGER DEFAULT 30)
RETURNS TABLE(
  user_id UUID, name TEXT, avatar_url TEXT, coins INTEGER,
  friends_count INTEGER, followers_count INTEGER,
  is_friend BOOLEAN, is_following BOOLEAN,
  request_outgoing BOOLEAN, request_incoming BOOLEAN,
  incoming_request_id UUID
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_q TEXT := LOWER(TRIM(COALESCE(p_query, '')));
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(p.full_name, ''), 'Nova Explorer'),
    p.avatar_url,
    p.coins,
    p.friends_count,
    p.followers_count,
    EXISTS (SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(v_uid, p.id) AND f.user_b = GREATEST(v_uid, p.id)),
    EXISTS (SELECT 1 FROM public.follows fl
      WHERE fl.follower_id = v_uid AND fl.following_id = p.id),
    EXISTS (SELECT 1 FROM public.friend_requests fr
      WHERE fr.sender_id = v_uid AND fr.receiver_id = p.id AND fr.status = 'pending'),
    EXISTS (SELECT 1 FROM public.friend_requests fr
      WHERE fr.sender_id = p.id AND fr.receiver_id = v_uid AND fr.status = 'pending'),
    (SELECT fr.id FROM public.friend_requests fr
      WHERE fr.sender_id = p.id AND fr.receiver_id = v_uid AND fr.status = 'pending' LIMIT 1)
  FROM public.profiles p
  WHERE p.id <> v_uid
    AND (v_q = '' OR LOWER(COALESCE(p.full_name, '')) LIKE '%' || v_q || '%')
  ORDER BY p.coins DESC, p.created_at ASC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;

-- ============ PUBLIC PROFILE ============
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile RECORD;
  v_rank BIGINT;
  v_is_self BOOLEAN := (v_uid = p_user_id);
  v_is_friend BOOLEAN := false;
  v_is_following BOOLEAN := false;
  v_req_out BOOLEAN := false;
  v_req_in_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id, COALESCE(NULLIF(full_name, ''), 'Nova Explorer') AS full_name,
         avatar_url, coins, friends_count, followers_count, following_count, bio, created_at
    INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT rank INTO v_rank FROM public.get_leaderboard(200) WHERE user_id = p_user_id LIMIT 1;

  IF NOT v_is_self THEN
    SELECT EXISTS (SELECT 1 FROM public.friendships
      WHERE user_a = LEAST(v_uid, p_user_id) AND user_b = GREATEST(v_uid, p_user_id))
      INTO v_is_friend;
    SELECT EXISTS (SELECT 1 FROM public.follows
      WHERE follower_id = v_uid AND following_id = p_user_id)
      INTO v_is_following;
    SELECT EXISTS (SELECT 1 FROM public.friend_requests
      WHERE sender_id = v_uid AND receiver_id = p_user_id AND status = 'pending')
      INTO v_req_out;
    SELECT id INTO v_req_in_id FROM public.friend_requests
      WHERE sender_id = p_user_id AND receiver_id = v_uid AND status = 'pending' LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_self', v_is_self,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.full_name,
      'avatar_url', v_profile.avatar_url,
      'coins', v_profile.coins,
      'friends_count', v_profile.friends_count,
      'followers_count', v_profile.followers_count,
      'following_count', v_profile.following_count,
      'bio', v_profile.bio,
      'created_at', v_profile.created_at,
      'rank', v_rank
    ),
    'relationship', jsonb_build_object(
      'is_friend', v_is_friend,
      'is_following', v_is_following,
      'request_outgoing', v_req_out,
      'request_incoming', v_req_in_id IS NOT NULL,
      'incoming_request_id', v_req_in_id
    )
  );
END;
$$;

-- ============ LIST FRIENDS ============
CREATE OR REPLACE FUNCTION public.list_friends(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(user_id UUID, name TEXT, avatar_url TEXT, coins INTEGER, friends_since TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    CASE WHEN f.user_a = v_uid THEN f.user_b ELSE f.user_a END,
    COALESCE(NULLIF(p.full_name, ''), 'Nova Explorer'),
    p.avatar_url,
    p.coins,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.user_a = v_uid THEN f.user_b ELSE f.user_a END
  WHERE f.user_a = v_uid OR f.user_b = v_uid
  ORDER BY f.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

-- ============ LIST FRIEND REQUESTS ============
CREATE OR REPLACE FUNCTION public.list_friend_requests(p_box TEXT DEFAULT 'incoming')
RETURNS TABLE(
  request_id UUID, other_user_id UUID, name TEXT, avatar_url TEXT,
  coins INTEGER, created_at TIMESTAMPTZ, direction TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    fr.id,
    CASE WHEN fr.sender_id = v_uid THEN fr.receiver_id ELSE fr.sender_id END,
    COALESCE(NULLIF(p.full_name, ''), 'Nova Explorer'),
    p.avatar_url,
    p.coins,
    fr.created_at,
    CASE WHEN fr.sender_id = v_uid THEN 'outgoing' ELSE 'incoming' END
  FROM public.friend_requests fr
  JOIN public.profiles p ON p.id = CASE WHEN fr.sender_id = v_uid THEN fr.receiver_id ELSE fr.sender_id END
  WHERE fr.status = 'pending'
    AND (
      (p_box = 'incoming' AND fr.receiver_id = v_uid)
      OR (p_box = 'outgoing' AND fr.sender_id = v_uid)
    )
  ORDER BY fr.created_at DESC;
END;
$$;