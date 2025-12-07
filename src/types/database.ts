export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      qa_documents: {
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
      qa_sessions: {
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
      qa_messages: {
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
      qa_feedback_logs: {
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
      qa_evolution_history: {
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
export type QaevDocument = Database['public']['Tables']['qa_documents']['Row'];
export type QaevSession = Database['public']['Tables']['qa_sessions']['Row'];
export type QaevMessage = Database['public']['Tables']['qa_messages']['Row'];
export type QaevFeedbackLog = Database['public']['Tables']['qa_feedback_logs']['Row'];
export type QaevEvolutionHistory = Database['public']['Tables']['qa_evolution_history']['Row'];

export type InsertQaevDocument = Database['public']['Tables']['qa_documents']['Insert'];
export type InsertQaevSession = Database['public']['Tables']['qa_sessions']['Insert'];
export type InsertQaevMessage = Database['public']['Tables']['qa_messages']['Insert'];
export type InsertQaevFeedbackLog = Database['public']['Tables']['qa_feedback_logs']['Insert'];
export type InsertQaevEvolutionHistory = Database['public']['Tables']['qa_evolution_history']['Insert'];
