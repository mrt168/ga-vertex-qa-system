export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface GenerateContentRequest {
  prompt: string | any[];
  thinkingLevel?: 'low' | 'medium' | 'high';
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChunk {
  type: 'text' | 'sources' | 'done' | 'error';
  content?: string;
  sources?: DocumentSource[];
  messageId?: string;
  error?: string;
}

export interface DocumentSource {
  id: string;
  title: string;
  snippet: string;
  relevanceScore?: number;
}

export type MutationType = 'CLARITY' | 'DETAIL' | 'STRUCTURE' | 'QA_FOCUS';

export interface Feedback {
  id: string;
  user_query: string;
  ai_response: string;
  rating: 'GOOD' | 'BAD';
  feedback_text?: string;
}

export interface EvaluationResult {
  winner: 'A' | 'B';
  scores: {
    A: {
      correctness: number;
      helpfulness: number;
      clarity: number;
    };
    B: {
      correctness: number;
      helpfulness: number;
      clarity: number;
    };
  };
  reasoning: string;
}
