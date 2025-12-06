export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      qaev_documents: {
        Row: {
          id: string;
          drive_file_id: string;
          file_name: string;
          folder_id: string;
          generation: number;
          current_version: number;
          total_good_count: number;
          total_bad_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          drive_file_id: string;
          file_name: string;
          folder_id: string;
          generation?: number;
          current_version?: number;
          total_good_count?: number;
          total_bad_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          drive_file_id?: string;
          file_name?: string;
          folder_id?: string;
          generation?: number;
          current_version?: number;
          total_good_count?: number;
          total_bad_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      qaev_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      qaev_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          sources: Json | null;
          feedback_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          sources?: Json | null;
          feedback_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          sources?: Json | null;
          feedback_id?: string | null;
          created_at?: string;
        };
      };
      qaev_feedback_logs: {
        Row: {
          id: string;
          document_id: string | null;
          user_id: string;
          message_id: string | null;
          user_query: string;
          ai_response: string;
          rating: 'GOOD' | 'BAD';
          feedback_text: string | null;
          processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id?: string | null;
          user_id: string;
          message_id?: string | null;
          user_query: string;
          ai_response: string;
          rating: 'GOOD' | 'BAD';
          feedback_text?: string | null;
          processed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string | null;
          user_id?: string;
          message_id?: string | null;
          user_query?: string;
          ai_response?: string;
          rating?: 'GOOD' | 'BAD';
          feedback_text?: string | null;
          processed?: boolean;
          created_at?: string;
        };
      };
      qaev_evolution_history: {
        Row: {
          id: string;
          document_id: string;
          generation: number;
          mutation_type: string;
          win_rate: number | null;
          trigger_feedback_ids: string[] | null;
          previous_content_snapshot: string | null;
          new_content_snapshot: string | null;
          rollback_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          generation: number;
          mutation_type: string;
          win_rate?: number | null;
          trigger_feedback_ids?: string[] | null;
          previous_content_snapshot?: string | null;
          new_content_snapshot?: string | null;
          rollback_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          generation?: number;
          mutation_type?: string;
          win_rate?: number | null;
          trigger_feedback_ids?: string[] | null;
          previous_content_snapshot?: string | null;
          new_content_snapshot?: string | null;
          rollback_available?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

// Helper types for easier usage
export type QaevDocument = Database['public']['Tables']['qaev_documents']['Row'];
export type QaevSession = Database['public']['Tables']['qaev_sessions']['Row'];
export type QaevMessage = Database['public']['Tables']['qaev_messages']['Row'];
export type QaevFeedbackLog = Database['public']['Tables']['qaev_feedback_logs']['Row'];
export type QaevEvolutionHistory = Database['public']['Tables']['qaev_evolution_history']['Row'];

export type InsertQaevDocument = Database['public']['Tables']['qaev_documents']['Insert'];
export type InsertQaevSession = Database['public']['Tables']['qaev_sessions']['Insert'];
export type InsertQaevMessage = Database['public']['Tables']['qaev_messages']['Insert'];
export type InsertQaevFeedbackLog = Database['public']['Tables']['qaev_feedback_logs']['Insert'];
export type InsertQaevEvolutionHistory = Database['public']['Tables']['qaev_evolution_history']['Insert'];
