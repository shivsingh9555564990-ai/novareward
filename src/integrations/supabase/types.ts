export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_activity: {
        Row: {
          activity: string
          activity_date: string
          created_at: string
          id: string
          meta: Json | null
          reward: number
          user_id: string
        }
        Insert: {
          activity: string
          activity_date?: string
          created_at?: string
          id?: string
          meta?: Json | null
          reward?: number
          user_id: string
        }
        Update: {
          activity?: string
          activity_date?: string
          created_at?: string
          id?: string
          meta?: Json | null
          reward?: number
          user_id?: string
        }
        Relationships: []
      }
      device_signups: {
        Row: {
          created_at: string
          device_fp: string
          email_hint: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fp: string
          email_hint?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fp?: string
          email_hint?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      game_plays: {
        Row: {
          created_at: string
          device_fp: string | null
          game: string
          id: string
          meta: Json | null
          play_date: string
          reward: number
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fp?: string | null
          game: string
          id?: string
          meta?: Json | null
          play_date?: string
          reward?: number
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          device_fp?: string | null
          game?: string
          id?: string
          meta?: Json | null
          play_date?: string
          reward?: number
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      gift_card_brands: {
        Row: {
          category: string
          color: string | null
          created_at: string
          delivery_methods: string[]
          denominations: number[]
          description: string | null
          emoji: string | null
          id: string
          in_stock: boolean
          is_active: boolean
          is_popular: boolean
          logo_url: string | null
          max_inr: number
          min_inr: number
          name: string
          slug: string
          sort_order: number
          terms: string | null
          updated_at: string
        }
        Insert: {
          category: string
          color?: string | null
          created_at?: string
          delivery_methods?: string[]
          denominations?: number[]
          description?: string | null
          emoji?: string | null
          id?: string
          in_stock?: boolean
          is_active?: boolean
          is_popular?: boolean
          logo_url?: string | null
          max_inr?: number
          min_inr?: number
          name: string
          slug: string
          sort_order?: number
          terms?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          delivery_methods?: string[]
          denominations?: number[]
          description?: string | null
          emoji?: string | null
          id?: string
          in_stock?: boolean
          is_active?: boolean
          is_popular?: boolean
          logo_url?: string | null
          max_inr?: number
          min_inr?: number
          name?: string
          slug?: string
          sort_order?: number
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          meta: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_completions: {
        Row: {
          created_at: string
          id: string
          offer_id: string
          proof: Json | null
          reward_credited: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          offer_id: string
          proof?: Json | null
          reward_credited?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          offer_id?: string
          proof?: Json | null
          reward_credited?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_completions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          category: string | null
          completion_rate: number | null
          created_at: string
          cta_url: string | null
          description: string | null
          difficulty: number | null
          duration_min: number | null
          external_id: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_free: boolean
          kind: string
          provider: string
          requirements: Json | null
          reward_max: number
          reward_min: number
          sort_order: number
          steps: Json | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completion_rate?: number | null
          created_at?: string
          cta_url?: string | null
          description?: string | null
          difficulty?: number | null
          duration_min?: number | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_free?: boolean
          kind: string
          provider?: string
          requirements?: Json | null
          reward_max?: number
          reward_min?: number
          sort_order?: number
          steps?: Json | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completion_rate?: number | null
          created_at?: string
          cta_url?: string | null
          description?: string | null
          difficulty?: number | null
          duration_min?: number | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_free?: boolean
          kind?: string
          provider?: string
          requirements?: Json | null
          reward_max?: number
          reward_min?: number
          sort_order?: number
          steps?: Json | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          coins: number
          created_at: string
          followers_count: number
          following_count: number
          friends_count: number
          full_name: string | null
          id: string
          interests: string[] | null
          onboarded: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          followers_count?: number
          following_count?: number
          friends_count?: number
          full_name?: string | null
          id: string
          interests?: string[] | null
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          coins?: number
          created_at?: string
          followers_count?: number
          following_count?: number
          friends_count?: number
          full_name?: string | null
          id?: string
          interests?: string[] | null
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          category: string | null
          created_at: string
          id: string
          reward: number
          score: number
          total: number
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          reward?: number
          score?: number
          total?: number
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          reward?: number
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          category: string
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          question: string
        }
        Insert: {
          category: string
          correct_index: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          options: Json
          question: string
        }
        Update: {
          category?: string
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          question?: string
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          amount_inr: number
          brand: string | null
          coins_spent: number
          created_at: string
          delivered_at: string | null
          delivery_method: string
          expires_at: string | null
          id: string
          meta: Json | null
          status: string
          type: string
          updated_at: string
          upi_id: string | null
          user_id: string
          voucher_code: string | null
          voucher_pin: string | null
        }
        Insert: {
          amount_inr: number
          brand?: string | null
          coins_spent: number
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          expires_at?: string | null
          id?: string
          meta?: Json | null
          status?: string
          type: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
          voucher_code?: string | null
          voucher_pin?: string | null
        }
        Update: {
          amount_inr?: number
          brand?: string | null
          coins_spent?: number
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          expires_at?: string | null
          id?: string
          meta?: Json | null
          status?: string
          type?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          voucher_code?: string | null
          voucher_pin?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_earned: number
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_earned?: number
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_earned?: number
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code_used: string
          created_at: string
          credited_at: string | null
          device_fp: string | null
          id: string
          ip_hash: string | null
          referred_reward: number
          referred_user_id: string
          referrer_id: string
          referrer_reward: number
          status: string
        }
        Insert: {
          code_used: string
          created_at?: string
          credited_at?: string | null
          device_fp?: string | null
          id?: string
          ip_hash?: string | null
          referred_reward?: number
          referred_user_id: string
          referrer_id: string
          referrer_reward?: number
          status?: string
        }
        Update: {
          code_used?: string
          created_at?: string
          credited_at?: string | null
          device_fp?: string | null
          id?: string
          ip_hash?: string | null
          referred_reward?: number
          referred_user_id?: string
          referrer_id?: string
          referrer_reward?: number
          status?: string
        }
        Relationships: []
      }
      sponsored_offers: {
        Row: {
          accent_color: string | null
          animation_style: string
          badge_emoji: string | null
          badge_label: string | null
          created_at: string
          cta_url: string
          duration_label: string | null
          id: string
          is_active: boolean
          reward: number
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          animation_style?: string
          badge_emoji?: string | null
          badge_label?: string | null
          created_at?: string
          cta_url: string
          duration_label?: string | null
          id?: string
          is_active?: boolean
          reward?: number
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          animation_style?: string
          badge_emoji?: string | null
          badge_label?: string | null
          created_at?: string
          cta_url?: string
          duration_label?: string | null
          id?: string
          is_active?: boolean
          reward?: number
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json | null
          reference_id: string | null
          source: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          reference_id?: string | null
          source?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          reference_id?: string | null
          source?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      voucher_codes: {
        Row: {
          amount_inr: number
          assigned_user_id: string | null
          brand_slug: string
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_used: boolean
          pin: string | null
          redemption_id: string | null
          used_at: string | null
        }
        Insert: {
          amount_inr: number
          assigned_user_id?: string | null
          brand_slug: string
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          pin?: string | null
          redemption_id?: string | null
          used_at?: string | null
        }
        Update: {
          amount_inr?: number
          assigned_user_id?: string | null
          brand_slug?: string
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_used?: boolean
          pin?: string | null
          redemption_id?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: { Args: { p_request_id: string }; Returns: Json }
      apply_referral_code: {
        Args: { p_code: string; p_device_fp: string }
        Returns: Json
      }
      cancel_friend_request: { Args: { p_request_id: string }; Returns: Json }
      check_device_signup: { Args: { p_device_fp: string }; Returns: Json }
      claim_daily_activity: {
        Args: { p_activity: string; p_meta?: Json; p_reward: number }
        Returns: Json
      }
      complete_quiz: {
        Args: { p_category?: string; p_score: number; p_total?: number }
        Returns: Json
      }
      create_redemption: {
        Args: {
          p_amount_inr: number
          p_brand: string
          p_type: string
          p_upi_id?: string
        }
        Returns: Json
      }
      credit_referral_on_first_earn: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      credit_user_coins: {
        Args: {
          p_amount: number
          p_meta?: Json
          p_reference_id: string
          p_source: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      decline_friend_request: { Args: { p_request_id: string }; Returns: Json }
      enforce_device_single_account: {
        Args: { p_device_fp: string; p_email_hint: string }
        Returns: Json
      }
      follow_user: { Args: { p_target: string }; Returns: Json }
      gen_referral_code: { Args: never; Returns: string }
      get_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          coins: number
          name: string
          rank: number
          user_id: string
        }[]
      }
      get_user_profile: { Args: { p_user_id: string }; Returns: Json }
      list_friend_requests: {
        Args: { p_box?: string }
        Returns: {
          avatar_url: string
          coins: number
          created_at: string
          direction: string
          name: string
          other_user_id: string
          request_id: string
        }[]
      }
      list_friends: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          coins: number
          friends_since: string
          name: string
          user_id: string
        }[]
      }
      play_game: {
        Args: { p_device_fp: string; p_game: string; p_score: number }
        Returns: Json
      }
      register_device_signup: {
        Args: { p_device_fp: string; p_email_hint: string }
        Returns: Json
      }
      remove_friend: { Args: { p_other: string }; Returns: Json }
      search_users: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_url: string
          coins: number
          followers_count: number
          friends_count: number
          incoming_request_id: string
          is_following: boolean
          is_friend: boolean
          name: string
          request_incoming: boolean
          request_outgoing: boolean
          user_id: string
        }[]
      }
      send_friend_request: { Args: { p_receiver: string }; Returns: Json }
      unfollow_user: { Args: { p_target: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
