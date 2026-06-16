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
      ai_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          kind: string
          model: string | null
          prompt: Json | null
          response: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind: string
          model?: string | null
          prompt?: Json | null
          response?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          kind?: string
          model?: string | null
          prompt?: Json | null
          response?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          condition: Json
          created_at: string
          id: string
          is_active: boolean
          market_index: Database["public"]["Enums"]["market_index"] | null
          message: string | null
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          condition: Json
          created_at?: string
          id?: string
          is_active?: boolean
          market_index?: Database["public"]["Enums"]["market_index"] | null
          message?: string | null
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          condition?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          market_index?: Database["public"]["Enums"]["market_index"] | null
          message?: string | null
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          capital: number
          confidence: number | null
          created_at: string
          direction: Database["public"]["Enums"]["direction_kind"] | null
          entry: number | null
          horizon: Database["public"]["Enums"]["time_horizon"]
          id: string
          inputs: Json
          market_index: Database["public"]["Enums"]["market_index"]
          market_summary: string | null
          model: string | null
          reasoning: string | null
          risk: Database["public"]["Enums"]["risk_profile"]
          risk_analysis: string | null
          risk_reward: number | null
          signal: Database["public"]["Enums"]["signal_kind"] | null
          stop_loss: number | null
          style: Database["public"]["Enums"]["trading_style"]
          target1: number | null
          target2: number | null
          target3: number | null
          user_id: string
          weights: Json
        }
        Insert: {
          capital: number
          confidence?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["direction_kind"] | null
          entry?: number | null
          horizon: Database["public"]["Enums"]["time_horizon"]
          id?: string
          inputs?: Json
          market_index: Database["public"]["Enums"]["market_index"]
          market_summary?: string | null
          model?: string | null
          reasoning?: string | null
          risk: Database["public"]["Enums"]["risk_profile"]
          risk_analysis?: string | null
          risk_reward?: number | null
          signal?: Database["public"]["Enums"]["signal_kind"] | null
          stop_loss?: number | null
          style: Database["public"]["Enums"]["trading_style"]
          target1?: number | null
          target2?: number | null
          target3?: number | null
          user_id: string
          weights?: Json
        }
        Update: {
          capital?: number
          confidence?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["direction_kind"] | null
          entry?: number | null
          horizon?: Database["public"]["Enums"]["time_horizon"]
          id?: string
          inputs?: Json
          market_index?: Database["public"]["Enums"]["market_index"]
          market_summary?: string | null
          model?: string | null
          reasoning?: string | null
          risk?: Database["public"]["Enums"]["risk_profile"]
          risk_analysis?: string | null
          risk_reward?: number | null
          signal?: Database["public"]["Enums"]["signal_kind"] | null
          stop_loss?: number | null
          style?: Database["public"]["Enums"]["trading_style"]
          target1?: number | null
          target2?: number | null
          target3?: number | null
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      chat_history: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_history_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      economic_events: {
        Row: {
          actual: string | null
          category: string | null
          created_at: string
          event_date: string | null
          event_name: string
          forecast: string | null
          id: string
          importance: string | null
          meta: Json | null
          previous: string | null
          user_id: string
        }
        Insert: {
          actual?: string | null
          category?: string | null
          created_at?: string
          event_date?: string | null
          event_name: string
          forecast?: string | null
          id?: string
          importance?: string | null
          meta?: Json | null
          previous?: string | null
          user_id: string
        }
        Update: {
          actual?: string | null
          category?: string | null
          created_at?: string
          event_date?: string | null
          event_name?: string
          forecast?: string | null
          id?: string
          importance?: string | null
          meta?: Json | null
          previous?: string | null
          user_id?: string
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          accuracy: number | null
          actual_price: number | null
          confidence: number | null
          created_at: string
          direction: Database["public"]["Enums"]["direction_kind"] | null
          horizon: Database["public"]["Enums"]["time_horizon"]
          id: string
          market_index: Database["public"]["Enums"]["market_index"]
          predicted_price: number | null
          predicted_range: Json | null
          reasoning: string | null
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          actual_price?: number | null
          confidence?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["direction_kind"] | null
          horizon: Database["public"]["Enums"]["time_horizon"]
          id?: string
          market_index: Database["public"]["Enums"]["market_index"]
          predicted_price?: number | null
          predicted_range?: Json | null
          reasoning?: string | null
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          actual_price?: number | null
          confidence?: number | null
          created_at?: string
          direction?: Database["public"]["Enums"]["direction_kind"] | null
          horizon?: Database["public"]["Enums"]["time_horizon"]
          id?: string
          market_index?: Database["public"]["Enums"]["market_index"]
          predicted_price?: number | null
          predicted_range?: Json | null
          reasoning?: string | null
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          credentials: Json
          expires_at: string | null
          id: string
          meta: Json
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          expires_at?: string | null
          id?: string
          meta?: Json
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          expires_at?: string | null
          id?: string
          meta?: Json
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_data: {
        Row: {
          candles: Json
          fetched_at: string
          id: string
          market_index: Database["public"]["Enums"]["market_index"]
          timeframe: string
          user_id: string
        }
        Insert: {
          candles: Json
          fetched_at?: string
          id?: string
          market_index: Database["public"]["Enums"]["market_index"]
          timeframe: string
          user_id: string
        }
        Update: {
          candles?: Json
          fetched_at?: string
          id?: string
          market_index?: Database["public"]["Enums"]["market_index"]
          timeframe?: string
          user_id?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          created_at: string
          id: string
          published_at: string | null
          raw: Json | null
          source: string | null
          summary: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_at?: string | null
          raw?: Json | null
          source?: string | null
          summary?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string | null
          raw?: Json | null
          source?: string | null
          summary?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      option_chain: {
        Row: {
          expiry: string | null
          fetched_at: string
          id: string
          market_index: Database["public"]["Enums"]["market_index"]
          max_pain: number | null
          pcr: number | null
          rows: Json
          spot: number | null
          user_id: string
        }
        Insert: {
          expiry?: string | null
          fetched_at?: string
          id?: string
          market_index: Database["public"]["Enums"]["market_index"]
          max_pain?: number | null
          pcr?: number | null
          rows: Json
          spot?: number | null
          user_id: string
        }
        Update: {
          expiry?: string | null
          fetched_at?: string
          id?: string
          market_index?: Database["public"]["Enums"]["market_index"]
          max_pain?: number | null
          pcr?: number | null
          rows?: Json
          spot?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sentiment: {
        Row: {
          bearish_score: number | null
          bullish_score: number | null
          created_at: string
          id: string
          impact_score: number | null
          news_id: string | null
          rationale: string | null
          sentiment_score: number | null
          user_id: string
        }
        Insert: {
          bearish_score?: number | null
          bullish_score?: number | null
          created_at?: string
          id?: string
          impact_score?: number | null
          news_id?: string | null
          rationale?: string | null
          sentiment_score?: number | null
          user_id: string
        }
        Update: {
          bearish_score?: number | null
          bullish_score?: number | null
          created_at?: string
          id?: string
          impact_score?: number | null
          news_id?: string | null
          rationale?: string | null
          sentiment_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          default_capital: number | null
          default_horizon: Database["public"]["Enums"]["time_horizon"] | null
          default_index: Database["public"]["Enums"]["market_index"] | null
          default_risk: Database["public"]["Enums"]["risk_profile"] | null
          default_style: Database["public"]["Enums"]["trading_style"] | null
          notifications: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_capital?: number | null
          default_horizon?: Database["public"]["Enums"]["time_horizon"] | null
          default_index?: Database["public"]["Enums"]["market_index"] | null
          default_risk?: Database["public"]["Enums"]["risk_profile"] | null
          default_style?: Database["public"]["Enums"]["trading_style"] | null
          notifications?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_capital?: number | null
          default_horizon?: Database["public"]["Enums"]["time_horizon"] | null
          default_index?: Database["public"]["Enums"]["market_index"] | null
          default_risk?: Database["public"]["Enums"]["risk_profile"] | null
          default_style?: Database["public"]["Enums"]["trading_style"] | null
          notifications?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          analysis_id: string | null
          confidence: number | null
          created_at: string
          entry: number | null
          id: string
          market_index: Database["public"]["Enums"]["market_index"]
          signal: Database["public"]["Enums"]["signal_kind"]
          status: string
          stop_loss: number | null
          target1: number | null
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          confidence?: number | null
          created_at?: string
          entry?: number | null
          id?: string
          market_index: Database["public"]["Enums"]["market_index"]
          signal: Database["public"]["Enums"]["signal_kind"]
          status?: string
          stop_loss?: number | null
          target1?: number | null
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          confidence?: number | null
          created_at?: string
          entry?: number | null
          id?: string
          market_index?: Database["public"]["Enums"]["market_index"]
          signal?: Database["public"]["Enums"]["signal_kind"]
          status?: string
          stop_loss?: number | null
          target1?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weights_history: {
        Row: {
          analysis_id: string | null
          created_at: string
          id: string
          rationale: string | null
          user_id: string
          weights: Json
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          user_id: string
          weights: Json
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          user_id?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "weights_history_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      direction_kind: "bullish" | "bearish" | "neutral"
      market_index:
        | "NIFTY50"
        | "BANKNIFTY"
        | "SENSEX"
        | "FINNIFTY"
        | "MIDCPNIFTY"
        | "NIFTYNXT50"
      risk_profile: "conservative" | "moderate" | "aggressive"
      signal_kind: "BUY" | "SELL" | "CALL" | "PUT" | "HOLD"
      time_horizon:
        | "1h"
        | "same_day"
        | "next_session"
        | "next_day"
        | "next_week"
      trading_style:
        | "intraday"
        | "swing"
        | "positional"
        | "futures"
        | "options"
        | "longterm"
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
    Enums: {
      app_role: ["admin", "user"],
      direction_kind: ["bullish", "bearish", "neutral"],
      market_index: [
        "NIFTY50",
        "BANKNIFTY",
        "SENSEX",
        "FINNIFTY",
        "MIDCPNIFTY",
        "NIFTYNXT50",
      ],
      risk_profile: ["conservative", "moderate", "aggressive"],
      signal_kind: ["BUY", "SELL", "CALL", "PUT", "HOLD"],
      time_horizon: ["1h", "same_day", "next_session", "next_day", "next_week"],
      trading_style: [
        "intraday",
        "swing",
        "positional",
        "futures",
        "options",
        "longterm",
      ],
    },
  },
} as const
