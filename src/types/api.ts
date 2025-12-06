export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeedbackRequest {
  messageId: string;
  rating: 'GOOD' | 'BAD';
  feedbackText?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
}

export interface EvolutionTriggerRequest {
  documentId?: string;
  dryRun?: boolean;
}

export interface EvolutionTriggerResponse {
  executionId?: string;
  targetDocuments: Array<{
    documentId: string;
    fileName: string;
    badCount: number;
  }>;
  status: 'started' | 'no_targets' | 'error';
  message?: string;
}

export interface DocumentSyncRequest {
  folderId?: string;
}

export interface DocumentSyncResponse {
  synced: number;
  added: number;
  updated: number;
}
