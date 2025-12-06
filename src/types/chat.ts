export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DocumentSource[];
  feedbackId?: string;
  createdAt: Date;
}

export interface DocumentSource {
  id: string;
  title: string;
  snippet: string;
  relevanceScore?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatState {
  currentSessionId: string | null;
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;
}

export interface SendMessageRequest {
  sessionId: string;
  message: string;
}

export interface SendMessageResponse {
  messageId: string;
  content: string;
  sources?: DocumentSource[];
}
