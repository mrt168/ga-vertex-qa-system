/**
 * GA Evolution Types
 * 遺伝的アルゴリズムの型定義
 */

export type MutationType =
  | 'MUTATION_CLARITY'      // 明確化のための変異
  | 'MUTATION_DETAIL'       // 詳細追加
  | 'MUTATION_SIMPLIFY'     // 簡略化
  | 'MUTATION_QA_FORMAT'    // Q&A形式への変換
  | 'CROSSOVER_MERGE'       // 複数ドキュメントの統合
  | 'CROSSOVER_EXTRACT';    // 共通部分の抽出

export interface DocumentCandidate {
  id: string;
  content: string;
  mutationType: MutationType;
  sourceDocumentId: string;
  parentDocumentIds?: string[];
}

export interface EvaluationResult {
  candidateId: string;
  score: number;
  winRate: number;
  metrics: {
    helpfulness: number;
    correctness: number;
    coherence: number;
  };
  comparisonDetails?: {
    originalScore: number;
    candidateScore: number;
    winner: 'original' | 'candidate' | 'tie';
  };
}

export interface EvolutionJob {
  id: string;
  documentId: string;
  triggerFeedbackIds: string[];
  status: 'pending' | 'generating' | 'evaluating' | 'updating' | 'completed' | 'failed';
  candidates: DocumentCandidate[];
  evaluationResults: EvaluationResult[];
  winnerCandidateId?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface FeedbackContext {
  feedbackId: string;
  userQuery: string;
  aiResponse: string;
  rating: 'GOOD' | 'BAD';
  feedbackText?: string;
  documentId?: string;
}

export interface EvolutionConfig {
  // 進化をトリガーするための低評価の閾値
  badFeedbackThreshold: number;
  // 生成する候補の数
  candidateCount: number;
  // 評価に使用する過去のQ&A数
  evaluationSampleSize: number;
  // 勝利と判定するための最小スコア差
  minWinMargin: number;
  // 自動更新を有効にするか（falseの場合は人間の承認が必要）
  autoUpdate: boolean;
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  badFeedbackThreshold: 3,
  candidateCount: 3,
  evaluationSampleSize: 5,
  minWinMargin: 0.1,
  autoUpdate: false, // 最初は人間の承認が必要
};
