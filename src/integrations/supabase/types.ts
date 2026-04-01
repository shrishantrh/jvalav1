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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_type: string
          activity_value: string | null
          created_at: string | null
          duration_minutes: number | null
          follow_up_result: Json | null
          followed_up: boolean | null
          id: string
          intensity: string | null
          metadata: Json | null
          timestamp: string
          user_id: string
        }
        Insert: {
          activity_type: string
          activity_value?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          follow_up_result?: Json | null
          followed_up?: boolean | null
          id?: string
          intensity?: string | null
          metadata?: Json | null
          timestamp?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          activity_value?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          follow_up_result?: Json | null
          followed_up?: boolean | null
          id?: string
          intensity?: string | null
          metadata?: Json | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          evidence_count: number
          id: string
          importance: number
          last_reinforced_at: string
          memory_type: string
          metadata: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          evidence_count?: number
          id?: string
          importance?: number
          last_reinforced_at?: string
          memory_type: string
          metadata?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          evidence_count?: number
          id?: string
          importance?: number
          last_reinforced_at?: string
          memory_type?: string
          metadata?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      correlations: {
        Row: {
          avg_delay_minutes: number | null
          confidence: number | null
          created_at: string | null
          id: string
          last_occurred: string | null
          occurrence_count: number | null
          outcome_type: string
          outcome_value: string
          trigger_type: string
          trigger_value: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_delay_minutes?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_occurred?: string | null
          occurrence_count?: number | null
          outcome_type: string
          outcome_value: string
          trigger_type: string
          trigger_value: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_delay_minutes?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_occurred?: string | null
          occurrence_count?: number | null
          outcome_type?: string
          outcome_value?: string
          trigger_type?: string
          trigger_value?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      discoveries: {
        Row: {
          acknowledged_at: string | null
          avg_delay_hours: number | null
          category: string
          confidence: number
          created_at: string
          discovery_type: string
          evidence_summary: string | null
          factor_a: string
          factor_b: string | null
          id: string
          last_evidence_at: string | null
          lift: number | null
          occurrence_count: number
          p_value: number | null
          relationship: string
          status: string
          supporting_entry_ids: string[] | null
          surfaced_at: string | null
          total_exposures: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          avg_delay_hours?: number | null
          category: string
          confidence?: number
          created_at?: string
          discovery_type: string
          evidence_summary?: string | null
          factor_a: string
          factor_b?: string | null
          id?: string
          last_evidence_at?: string | null
          lift?: number | null
          occurrence_count?: number
          p_value?: number | null
          relationship?: string
          status?: string
          supporting_entry_ids?: string[] | null
          surfaced_at?: string | null
          total_exposures?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          avg_delay_hours?: number | null
          category?: string
          confidence?: number
          created_at?: string
          discovery_type?: string
          evidence_summary?: string | null
          factor_a?: string
          factor_b?: string | null
          id?: string
          last_evidence_at?: string | null
          lift?: number | null
          occurrence_count?: number
          p_value?: number | null
          relationship?: string
          status?: string
          supporting_entry_ids?: string[] | null
          surfaced_at?: string | null
          total_exposures?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ehr_connections: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          metadata: Json
          provider_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          provider_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          metadata?: Json
          provider_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ehr_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          provider_id: string
          refresh_token: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider_id: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          provider_id?: string
          refresh_token?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engagement: {
        Row: {
          badges: string[] | null
          created_at: string
          current_streak: number | null
          home_shortcuts: string[] | null
          last_evening_sent: string | null
          last_log_date: string | null
          last_morning_sent: string | null
          longest_streak: number | null
          reminder_enabled: boolean | null
          reminder_times: string[] | null
          total_logs: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          badges?: string[] | null
          created_at?: string
          current_streak?: number | null
          home_shortcuts?: string[] | null
          last_evening_sent?: string | null
          last_log_date?: string | null
          last_morning_sent?: string | null
          longest_streak?: number | null
          reminder_enabled?: boolean | null
          reminder_times?: string[] | null
          total_logs?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          badges?: string[] | null
          created_at?: string
          current_streak?: number | null
          home_shortcuts?: string[] | null
          last_evening_sent?: string | null
          last_log_date?: string | null
          last_morning_sent?: string | null
          longest_streak?: number | null
          reminder_enabled?: boolean | null
          reminder_times?: string[] | null
          total_logs?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fitbit_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flare_entries: {
        Row: {
          city: string | null
          created_at: string
          duration_minutes: number | null
          end_timestamp: string | null
          energy_level: string | null
          entry_type: string
          environmental_data: Json | null
          follow_ups: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          medications: string[] | null
          note: string | null
          photos: string[] | null
          physiological_data: Json | null
          severity: string | null
          symptoms: string[] | null
          timestamp: string
          triggers: string[] | null
          user_id: string
          voice_transcript: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          duration_minutes?: number | null
          end_timestamp?: string | null
          energy_level?: string | null
          entry_type: string
          environmental_data?: Json | null
          follow_ups?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          medications?: string[] | null
          note?: string | null
          photos?: string[] | null
          physiological_data?: Json | null
          severity?: string | null
          symptoms?: string[] | null
          timestamp: string
          triggers?: string[] | null
          user_id: string
          voice_transcript?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          duration_minutes?: number | null
          end_timestamp?: string | null
          energy_level?: string | null
          entry_type?: string
          environmental_data?: Json | null
          follow_ups?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          medications?: string[] | null
          note?: string | null
          photos?: string[] | null
          physiological_data?: Json | null
          severity?: string | null
          symptoms?: string[] | null
          timestamp?: string
          triggers?: string[] | null
          user_id?: string
          voice_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flare_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_logs: {
        Row: {
          added_sugars_g: number | null
          ai_confidence: number | null
          barcode: string | null
          brand: string | null
          calcium_mg: number | null
          calories: number | null
          cholesterol_mg: number | null
          created_at: string
          dietary_fiber_g: number | null
          food_name: string
          id: string
          iron_mg: number | null
          logged_at: string
          meal_type: string | null
          photos: string[] | null
          potassium_mg: number | null
          protein_g: number | null
          raw_ai_response: Json | null
          saturated_fat_g: number | null
          serving_size: string | null
          servings: number | null
          sodium_mg: number | null
          source: string
          total_carbs_g: number | null
          total_fat_g: number | null
          total_sugars_g: number | null
          trans_fat_g: number | null
          updated_at: string
          user_id: string
          vitamin_a_mcg: number | null
          vitamin_c_mg: number | null
          vitamin_d_mcg: number | null
        }
        Insert: {
          added_sugars_g?: number | null
          ai_confidence?: number | null
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          calories?: number | null
          cholesterol_mg?: number | null
          created_at?: string
          dietary_fiber_g?: number | null
          food_name: string
          id?: string
          iron_mg?: number | null
          logged_at?: string
          meal_type?: string | null
          photos?: string[] | null
          potassium_mg?: number | null
          protein_g?: number | null
          raw_ai_response?: Json | null
          saturated_fat_g?: number | null
          serving_size?: string | null
          servings?: number | null
          sodium_mg?: number | null
          source?: string
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_sugars_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          user_id: string
          vitamin_a_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
        }
        Update: {
          added_sugars_g?: number | null
          ai_confidence?: number | null
          barcode?: string | null
          brand?: string | null
          calcium_mg?: number | null
          calories?: number | null
          cholesterol_mg?: number | null
          created_at?: string
          dietary_fiber_g?: number | null
          food_name?: string
          id?: string
          iron_mg?: number | null
          logged_at?: string
          meal_type?: string | null
          photos?: string[] | null
          potassium_mg?: number | null
          protein_g?: number | null
          raw_ai_response?: Json | null
          saturated_fat_g?: number | null
          serving_size?: string | null
          servings?: number | null
          sodium_mg?: number | null
          source?: string
          total_carbs_g?: number | null
          total_fat_g?: number | null
          total_sugars_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          user_id?: string
          vitamin_a_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string
          dosage: string | null
          frequency: string | null
          id: string
          medication_name: string
          taken_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          medication_name: string
          taken_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          frequency?: string | null
          id?: string
          medication_name?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      physician_access: {
        Row: {
          access_count: number | null
          access_level: string | null
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          last_accessed: string | null
          physician_email: string | null
          physician_name: string | null
          physician_practice: string | null
          user_id: string
        }
        Insert: {
          access_count?: number | null
          access_level?: string | null
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          last_accessed?: string | null
          physician_email?: string | null
          physician_name?: string | null
          physician_practice?: string | null
          user_id: string
        }
        Update: {
          access_count?: number | null
          access_level?: string | null
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          last_accessed?: string | null
          physician_email?: string | null
          physician_name?: string | null
          physician_practice?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          biological_sex: string | null
          blood_type: string | null
          conditions: string[] | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          gender: string | null
          height_cm: number | null
          id: string
          known_symptoms: string[] | null
          known_triggers: string[] | null
          metadata: Json | null
          onboarding_completed: boolean | null
          phone_number: string | null
          physician_email: string | null
          physician_name: string | null
          physician_phone: string | null
          physician_practice: string | null
          share_enabled: boolean | null
          share_password_hash: string | null
          share_token: string | null
          terms_accepted_at: string | null
          timezone: string | null
          tour_status: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          biological_sex?: string | null
          blood_type?: string | null
          conditions?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          known_symptoms?: string[] | null
          known_triggers?: string[] | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          physician_email?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          physician_practice?: string | null
          share_enabled?: boolean | null
          share_password_hash?: string | null
          share_token?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          tour_status?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          biological_sex?: string | null
          blood_type?: string | null
          conditions?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          known_symptoms?: string[] | null
          known_triggers?: string[] | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          phone_number?: string | null
          physician_email?: string | null
          physician_name?: string | null
          physician_phone?: string | null
          physician_practice?: string | null
          share_enabled?: boolean | null
          share_password_hash?: string | null
          share_token?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          tour_status?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string
          device_token: string | null
          endpoint: string | null
          id: string
          p256dh_key: string | null
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string
          device_token?: string | null
          endpoint?: string | null
          id?: string
          p256dh_key?: string | null
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string
          device_token?: string | null
          endpoint?: string | null
          id?: string
          p256dh_key?: string | null
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_exports: {
        Row: {
          created_at: string
          expires_at: string | null
          export_type: string
          file_path: string | null
          id: string
          metadata: Json | null
          password_hash: string | null
          share_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          export_type: string
          file_path?: string | null
          id?: string
          metadata?: Json | null
          password_hash?: string | null
          share_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          export_type?: string
          file_path?: string | null
          id?: string
          metadata?: Json | null
          password_hash?: string | null
          share_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          phone_number: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phone_number: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phone_number?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      temp_auth_relay: {
        Row: {
          created_at: string | null
          nonce: string
          tokens: Json
        }
        Insert: {
          created_at?: string | null
          nonce: string
          tokens: Json
        }
        Update: {
          created_at?: string | null
          nonce?: string
          tokens?: Json
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          avg_severity: number | null
          created_at: string | null
          flare_count: number | null
          health_score: number | null
          id: string
          key_insights: Json | null
          logging_consistency: number | null
          top_correlations: Json | null
          top_symptoms: Json | null
          top_triggers: Json | null
          trend: string | null
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          avg_severity?: number | null
          created_at?: string | null
          flare_count?: number | null
          health_score?: number | null
          id?: string
          key_insights?: Json | null
          logging_consistency?: number | null
          top_correlations?: Json | null
          top_symptoms?: Json | null
          top_triggers?: Json | null
          trend?: string | null
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          avg_severity?: number | null
          created_at?: string | null
          flare_count?: number | null
          health_score?: number | null
          id?: string
          key_insights?: Json | null
          logging_consistency?: number | null
          top_correlations?: Json | null
          top_symptoms?: Json | null
          top_triggers?: Json | null
          trend?: string | null
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      community_hotspots: {
        Row: {
          avg_severity: number | null
          city: string | null
          monthly_count: number | null
          recent_count: number | null
          report_count: number | null
          top_symptom: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_city_symptom_stats: {
        Args: { city_name: string }
        Returns: {
          frequency: number
          symptom: string
        }[]
      }
      get_city_trigger_stats: {
        Args: { city_name: string }
        Returns: {
          frequency: number
          trigger: string
        }[]
      }
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
