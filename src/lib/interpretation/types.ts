/**
 * Interpretation Layer Types
 * 解釈レイヤーの型定義
 */

// ルール種別
export type RuleType =
  | 'CONTEXT'           // 補足情報・前提条件
  | 'CLARIFICATION'     // 曖昧な箇所の解釈ガイド
  | 'FORMAT'            // 最適な回答形式
  | 'MISUNDERSTANDING'  // よくある誤解と正しい解釈
  | 'RELATED';          // 関連ドキュメントへの参照

// 解釈ルール
export interface InterpretationRule {
  id: string;
  document_id: string;
  rule_type: RuleType;
  content: string;
  trigger_pattern: string | null;
  generation: number;
  score: number;
  enabled: boolean;
  source_feedback_ids: string[];
  created_at: string;
  updated_at: string;
}

// 解釈ルール適用履歴
export interface InterpretationApplication {
  id: string;
  message_id: string;
  document_id: string;
  applied_rule_ids: string[];
  feedback_rating: 'GOOD' | 'BAD' | null;
  created_at: string;
}

// 解釈ルール候補（進化時に生成）
export interface InterpretationCandidate {
  rule_type: RuleType;
  content: string;
  trigger_pattern?: string;
  rationale: string;  // なぜこのルールが必要か
}

// 評価結果
export interface InterpretationEvaluationResult {
  candidate: InterpretationCandidate;
  win_rate: number;
  avg_score: number;
  sample_comparisons: number;
  metrics: {
    helpfulness: number;
    correctness: number;
    coherence: number;
  };
}

// 進化ジョブ
export interface InterpretationEvolutionJob {
  id: string;
  document_id: string;
  trigger_feedback_ids: string[];
  status: 'pending' | 'generating' | 'evaluating' | 'completed' | 'failed';
  candidates: InterpretationCandidate[];
  evaluation_results: InterpretationEvaluationResult[];
  adopted_rules: InterpretationRule[];
  error?: string;
  started_at: string;
  completed_at?: string;
}

// 進化設定
export interface InterpretationEvolutionConfig {
  // 進化をトリガーするための低評価の閾値
  badFeedbackThreshold: number;
  // 生成する候補の数（ルールタイプごと）
  candidateCount: number;
  // 評価に使用するサンプル質問数
  evaluationSampleSize: number;
  // 採用するための最小勝率
  minWinRate: number;
  // ルールを自動で有効化するか
  autoEnable: boolean;
}

export const DEFAULT_INTERPRETATION_EVOLUTION_CONFIG: InterpretationEvolutionConfig = {
  badFeedbackThreshold: 3,
  candidateCount: 3,
  evaluationSampleSize: 5,
  minWinRate: 0.6,
  autoEnable: true,
};

// ルール統計
export interface InterpretationStats {
  total_rules: number;
  enabled_rules: number;
  rules_by_type: Record<RuleType, number>;
  avg_score: number;
  total_applications: number;
  positive_feedback_rate: number;
}

// DB Insert/Update types
export interface InsertInterpretationRule {
  id?: string;
  document_id: string;
  rule_type: RuleType;
  content: string;
  trigger_pattern?: string | null;
  generation?: number;
  score?: number;
  enabled?: boolean;
  source_feedback_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface UpdateInterpretationRule {
  rule_type?: RuleType;
  content?: string;
  trigger_pattern?: string | null;
  generation?: number;
  score?: number;
  enabled?: boolean;
  source_feedback_ids?: string[];
  updated_at?: string;
}

export interface InsertInterpretationApplication {
  id?: string;
  message_id: string;
  document_id: string;
  applied_rule_ids: string[];
  feedback_rating?: 'GOOD' | 'BAD' | null;
  created_at?: string;
}

// =====================================================
// Self-Evolution Types（自己進化機能）
// =====================================================

// 質問の難易度
export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'edge_case';

// 質問のカテゴリ
export type QuestionCategory =
  | 'factual'        // 事実確認（〜はどこに記載されていますか？）
  | 'procedural'     // 手順確認（〜の手順を教えてください）
  | 'clarification'  // 曖昧な点の確認（〜とは具体的に何ですか？）
  | 'comparison'     // 比較（AとBの違いは？）
  | 'edge_case'      // エッジケース（〜の場合はどうなりますか？）
  | 'implicit';      // 暗黙の知識（前提知識が必要な質問）

// 合成質問
export interface SyntheticQuestion {
  question: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expected_topics: string[];  // 回答に含まれるべきトピック
  rationale: string;          // なぜこの質問が重要か
}

// 自己評価結果
export interface SelfEvaluationResult {
  question: SyntheticQuestion;
  response_without_rule: string;
  response_with_rule: string;
  evaluation: {
    winner: 'without_rule' | 'with_rule' | 'tie';
    scores: {
      without_rule: {
        accuracy: number;      // 正確性 (1-5)
        completeness: number;  // 完全性 (1-5)
        clarity: number;       // 明瞭性 (1-5)
        relevance: number;     // 関連性 (1-5)
      };
      with_rule: {
        accuracy: number;
        completeness: number;
        clarity: number;
        relevance: number;
      };
    };
    reasoning: string;
    improvement_suggestions: string[];
  };
}

// Self-Evolution ジョブ
export interface SelfEvolutionJob {
  id: string;
  document_id: string;
  status: 'pending' | 'generating_questions' | 'evaluating' | 'generating_rules' | 'completed' | 'failed';
  synthetic_questions: SyntheticQuestion[];
  evaluation_results: SelfEvaluationResult[];
  identified_weaknesses: DocumentWeakness[];
  generated_candidates: InterpretationCandidate[];
  adopted_rules: InterpretationRule[];
  metrics: {
    questions_generated: number;
    evaluations_completed: number;
    weaknesses_found: number;
    rules_adopted: number;
    avg_improvement: number;
  };
  error?: string;
  started_at: string;
  completed_at?: string;
}

// ドキュメントの弱点
export interface DocumentWeakness {
  type: 'missing_context' | 'ambiguous' | 'incomplete' | 'hard_to_find' | 'misleading';
  description: string;
  affected_questions: string[];
  suggested_rule_type: RuleType;
  confidence: number;  // 0-1
}

// Self-Evolution 設定
export interface SelfEvolutionConfig {
  // 生成する質問数
  questionsPerCategory: number;
  // 各カテゴリを含めるか
  includeCategories: QuestionCategory[];
  // 難易度の分布
  difficultyDistribution: Record<QuestionDifficulty, number>;
  // 弱点を認識するための閾値（スコア差）
  weaknessThreshold: number;
  // 採用するルールの最小改善率
  minImprovementRate: number;
  // 評価の繰り返し回数（信頼性向上）
  evaluationIterations: number;
  // 自動でルールを有効化するか
  autoEnable: boolean;
}

export const DEFAULT_SELF_EVOLUTION_CONFIG: SelfEvolutionConfig = {
  questionsPerCategory: 3,
  includeCategories: ['factual', 'procedural', 'clarification', 'comparison', 'edge_case', 'implicit'],
  difficultyDistribution: {
    easy: 0.2,
    medium: 0.4,
    hard: 0.3,
    edge_case: 0.1,
  },
  weaknessThreshold: 0.5,  // スコア差が0.5以上で弱点と認識
  minImprovementRate: 0.2, // 20%以上の改善で採用
  evaluationIterations: 2,
  autoEnable: true,
};
