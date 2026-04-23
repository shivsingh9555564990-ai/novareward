import { supabase } from "@/integrations/supabase/client";

/**
 * Decide where to send the user after a successful auth event.
 * - If the profile is fully set up (`onboarded = true`) → /home
 * - If the profile has a name+avatar but no interests yet → /interests
 * - Otherwise (brand-new user) → /profile-setup
 *
 * This guarantees returning users NEVER see profile-setup again.
 */
export const routeAfterAuth = async (userId: string): Promise<string> => {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("onboarded, full_name, avatar_url, interests")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return "/profile-setup";
    if (data.onboarded) return "/home";
    if (data.full_name && data.avatar_url) return "/interests";
    return "/profile-setup";
  } catch {
    return "/profile-setup";
  }
};
