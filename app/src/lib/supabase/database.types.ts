export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string;
          start_date: string;
          end_date: string;
          check_ins: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          notes?: string;
          start_date: string;
          end_date: string;
          check_ins?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          notes?: string;
          start_date?: string;
          end_date?: string;
          check_ins?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          birthdate: string | null;
          region_id: string;
          custom_life_expectancy: number | null;
          age_adjusted: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          birthdate?: string | null;
          region_id: string;
          custom_life_expectancy?: number | null;
          age_adjusted: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          birthdate?: string | null;
          region_id?: string;
          custom_life_expectancy?: number | null;
          age_adjusted?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
