// App constants
export const APP_NAME = '自己進化型 社内QAシステム';
export const APP_DESCRIPTION = 'GA x Vertex AI による自己進化型QAシステム';

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Evolution
export const EVOLUTION_TRIGGER_THRESHOLD =
  parseInt(process.env.EVOLUTION_TRIGGER_THRESHOLD || '3', 10);
export const MUTATION_CANDIDATE_COUNT = 3;

// Chat
export const MAX_MESSAGE_LENGTH = 2000;
export const STREAMING_TIMEOUT_MS = 30000;

// Gemini
export const GEMINI_MODEL = 'gemini-3-pro-preview';
export const GEMINI_MAX_TOKENS = 2048;
export const GEMINI_TEMPERATURE = 0.7;

// Ratings
export const RATING_GOOD = 'GOOD' as const;
export const RATING_BAD = 'BAD' as const;

// Mutation types
export const MUTATION_TYPES = {
  CLARITY: 'CLARITY',
  DETAIL: 'DETAIL',
  STRUCTURE: 'STRUCTURE',
  QA_FOCUS: 'QA_FOCUS',
} as const;
