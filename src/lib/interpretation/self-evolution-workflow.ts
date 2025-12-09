/**
 * Self-Evolution Workflow
 * 自己進化プロセスを統括
 * ユーザーフィードバックなしでAIが自律的に精度を改善
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { InterpretationService } from './interpretation-service';
import { SyntheticQuestionGenerator } from './synthetic-question-generator';
import { SelfEvaluationEngine } from './self-evaluation-engine';
import { InterpretationMutationEngine } from './mutation-engine';
import {
  SelfEvolutionJob,
  SelfEvolutionConfig,
  DEFAULT_SELF_EVOLUTION_CONFIG,
  InterpretationRule,
  InterpretationCandidate,
  DocumentWeakness,
  SyntheticQuestion,
  SelfEvaluationResult,
} from './types';
import { VertexGeminiClient } from '@/lib/gemini/vertex-client';
import { DocumentContentService } from '@/lib/documents/document-content-service';

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

export class SelfEvolutionWorkflow {
  private interpretationService: InterpretationService;
  private questionGenerator: SyntheticQuestionGenerator;
  private evaluationEngine: SelfEvaluationEngine;
  private mutationEngine: InterpretationMutationEngine;
  private documentContentService: DocumentContentService;

  constructor(
    private supabase: SupabaseClient,
    private geminiClient: VertexGeminiClient
  ) {
    this.interpretationService = new InterpretationService(supabase);
    this.questionGenerator = new SyntheticQuestionGenerator(geminiClient);
    this.evaluationEngine = new SelfEvaluationEngine(geminiClient);
    this.mutationEngine = new InterpretationMutationEngine(geminiClient);
    this.documentContentService = new DocumentContentService(supabase);
  }

  /**
   * 自己進化プロセスを実行
   */
  async run(
    documentId: string,
    config: Partial<SelfEvolutionConfig> = {}
  ): Promise<SelfEvolutionJob> {
    const fullConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...config };
    const jobId = uuidv4();
    const startedAt = new Date().toISOString();

    const job: SelfEvolutionJob = {
      id: jobId,
      document_id: documentId,
      status: 'pending',
      synthetic_questions: [],
      evaluation_results: [],
      identified_weaknesses: [],
      generated_candidates: [],
      adopted_rules: [],
      metrics: {
        questions_generated: 0,
        evaluations_completed: 0,
        weaknesses_found: 0,
        rules_adopted: 0,
        avg_improvement: 0,
      },
      started_at: startedAt,
    };

    try {
      // 1. ドキュメント取得
      const document = await this.getDocumentContent(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // 2. 質問生成フェーズ
      job.status = 'generating_questions';
      console.log(`[Self-Evolution] Generating questions for ${document.name}...`);

      const questions = await this.questionGenerator.generateQuestions(
        document,
        fullConfig
      );
      job.synthetic_questions = questions;
      job.metrics.questions_generated = questions.length;

      if (questions.length === 0) {
        console.log('[Self-Evolution] No questions generated');
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        return job;
      }

      // 3. 現在のルールを取得
      const currentRules = await this.interpretationService.getApplicableRules(
        documentId,
        ''  // 全ルールを取得
      );

      // 4. 評価フェーズ（ルールなし vs ルールあり）
      job.status = 'evaluating';
      console.log(`[Self-Evolution] Evaluating ${questions.length} questions...`);

      const evaluationResults = await this.evaluationEngine.evaluateWithComparison(
        document,
        questions,
        currentRules,
        fullConfig
      );
      job.evaluation_results = evaluationResults;
      job.metrics.evaluations_completed = evaluationResults.length;

      // 5. 弱点を特定
      const weaknesses = await this.evaluationEngine.identifyWeaknesses(
        evaluationResults,
        fullConfig
      );
      job.identified_weaknesses = weaknesses;
      job.metrics.weaknesses_found = weaknesses.length;

      if (weaknesses.length === 0) {
        console.log('[Self-Evolution] No weaknesses identified');
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        await this.recordJobHistory(job);
        return job;
      }

      // 6. ルール候補生成フェーズ
      job.status = 'generating_rules';
      console.log(`[Self-Evolution] Generating rules for ${weaknesses.length} weaknesses...`);

      const candidates = await this.generateRuleCandidatesFromWeaknesses(
        document,
        weaknesses,
        evaluationResults
      );
      job.generated_candidates = candidates;

      // 7. 候補を評価して採用
      const adoptedRules = await this.evaluateAndAdoptRules(
        document,
        candidates,
        questions,
        currentRules,
        fullConfig
      );
      job.adopted_rules = adoptedRules;
      job.metrics.rules_adopted = adoptedRules.length;

      // 8. 改善率を計算
      job.metrics.avg_improvement = this.calculateAverageImprovement(evaluationResults);

      // 9. 完了
      job.status = 'completed';
      job.completed_at = new Date().toISOString();

      // 10. 履歴を記録
      await this.recordJobHistory(job);

      console.log(
        `[Self-Evolution] Completed: ${adoptedRules.length} rules adopted, ` +
        `avg improvement: ${(job.metrics.avg_improvement * 100).toFixed(1)}%`
      );

      return job;
    } catch (error) {
      console.error('[Self-Evolution] Failed:', error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completed_at = new Date().toISOString();
      return job;
    }
  }

  /**
   * ドキュメント内容を取得
   */
  private async getDocumentContent(
    documentId: string
  ): Promise<DocumentContent | null> {
    const docContent = await this.documentContentService.getDocumentContent(documentId);

    if (!docContent) {
      return null;
    }

    return {
      id: docContent.id,
      content: docContent.content,
      name: docContent.name,
    };
  }

  /**
   * 弱点からルール候補を生成
   */
  private async generateRuleCandidatesFromWeaknesses(
    document: DocumentContent,
    weaknesses: DocumentWeakness[],
    evaluationResults: SelfEvaluationResult[]
  ): Promise<InterpretationCandidate[]> {
    const candidates: InterpretationCandidate[] = [];

    for (const weakness of weaknesses) {
      // 弱点に関連する評価結果を抽出
      const relatedResults = evaluationResults.filter(r =>
        weakness.affected_questions.includes(r.question.question)
      );

      // フィードバック形式に変換（MutationEngineと互換性を持たせる）
      const syntheticFeedbacks = relatedResults.map(r => ({
        user_query: r.question.question,
        ai_response: r.response_without_rule,
        feedback_text: `[自動検出] ${weakness.description}. 改善提案: ${r.evaluation.improvement_suggestions.join(', ')}`,
      }));

      if (syntheticFeedbacks.length > 0) {
        // 特定のルールタイプで候補を生成
        const candidate = await this.mutationEngine.generateSpecificTypeCandidate(
          document,
          syntheticFeedbacks,
          weakness.suggested_rule_type
        );

        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    return candidates;
  }

  /**
   * 候補を評価して採用
   */
  private async evaluateAndAdoptRules(
    document: DocumentContent,
    candidates: InterpretationCandidate[],
    questions: SyntheticQuestion[],
    existingRules: InterpretationRule[],
    config: SelfEvolutionConfig
  ): Promise<InterpretationRule[]> {
    const adoptedRules: InterpretationRule[] = [];
    const currentGeneration = await this.interpretationService.getCurrentGeneration(
      document.id
    );
    const nextGeneration = currentGeneration + 1;

    for (const candidate of candidates) {
      // 候補ルールを一時的なルールとして評価
      const tempRule: InterpretationRule = {
        id: 'temp-' + uuidv4(),
        document_id: document.id,
        rule_type: candidate.rule_type,
        content: candidate.content,
        trigger_pattern: candidate.trigger_pattern || null,
        generation: nextGeneration,
        score: 0.5,
        enabled: true,
        source_feedback_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 新ルールを追加した状態で再評価
      const rulesWithCandidate = [...existingRules, tempRule];

      // サンプル質問で評価
      const sampleQuestions = questions.slice(0, 5);
      const resultsWithCandidate = await this.evaluationEngine.evaluateWithComparison(
        document,
        sampleQuestions,
        rulesWithCandidate,
        { evaluationIterations: 1 }
      );

      // 既存ルールのみで評価
      const resultsWithoutCandidate = await this.evaluationEngine.evaluateWithComparison(
        document,
        sampleQuestions,
        existingRules,
        { evaluationIterations: 1 }
      );

      // 改善率を計算
      const improvementRate = this.calculateImprovementRate(
        resultsWithoutCandidate,
        resultsWithCandidate
      );

      console.log(
        `[Self-Evolution] Candidate ${candidate.rule_type}: improvement rate = ${(improvementRate * 100).toFixed(1)}%`
      );

      // 閾値以上なら採用
      if (improvementRate >= config.minImprovementRate) {
        const rule = await this.interpretationService.createRule({
          document_id: document.id,
          rule_type: candidate.rule_type,
          content: candidate.content,
          trigger_pattern: candidate.trigger_pattern || null,
          generation: nextGeneration,
          score: 0.5 + improvementRate, // 改善率に基づいてスコアを設定
          enabled: config.autoEnable,
          source_feedback_ids: [], // 自己進化では空
        });

        if (rule) {
          adoptedRules.push(rule);
        }
      }
    }

    return adoptedRules;
  }

  /**
   * 改善率を計算
   */
  private calculateImprovementRate(
    resultsBefore: SelfEvaluationResult[],
    resultsAfter: SelfEvaluationResult[]
  ): number {
    if (resultsBefore.length === 0 || resultsAfter.length === 0) {
      return 0;
    }

    const avgBefore = this.calculateAverageScore(resultsBefore);
    const avgAfter = this.calculateAverageScore(resultsAfter);

    return (avgAfter - avgBefore) / Math.max(avgBefore, 1);
  }

  /**
   * 平均スコアを計算
   */
  private calculateAverageScore(results: SelfEvaluationResult[]): number {
    if (results.length === 0) return 0;

    let total = 0;
    for (const result of results) {
      const scores = result.evaluation.scores.with_rule;
      total += (scores.accuracy + scores.completeness + scores.clarity + scores.relevance) / 4;
    }

    return total / results.length;
  }

  /**
   * 全体の平均改善率を計算
   */
  private calculateAverageImprovement(results: SelfEvaluationResult[]): number {
    if (results.length === 0) return 0;

    let totalImprovement = 0;
    let count = 0;

    for (const result of results) {
      const withoutRule = result.evaluation.scores.without_rule;
      const withRule = result.evaluation.scores.with_rule;

      const avgWithout = (withoutRule.accuracy + withoutRule.completeness + withoutRule.clarity + withoutRule.relevance) / 4;
      const avgWith = (withRule.accuracy + withRule.completeness + withRule.clarity + withRule.relevance) / 4;

      if (avgWithout > 0) {
        totalImprovement += (avgWith - avgWithout) / avgWithout;
        count++;
      }
    }

    return count > 0 ? totalImprovement / count : 0;
  }

  /**
   * ジョブ履歴を記録
   */
  private async recordJobHistory(job: SelfEvolutionJob): Promise<void> {
    try {
      await this.supabase.from('qaev_evolution_history').insert({
        document_id: job.document_id,
        generation: job.adopted_rules.length > 0 ? job.adopted_rules[0].generation : 0,
        mutation_type: 'SELF_EVOLUTION',
        win_rate: job.metrics.avg_improvement,
        trigger_feedback_ids: [], // 自己進化ではフィードバックなし
        previous_content_snapshot: JSON.stringify({
          questions_generated: job.metrics.questions_generated,
          weaknesses_found: job.metrics.weaknesses_found,
        }),
        new_content_snapshot: JSON.stringify({
          rules_adopted: job.metrics.rules_adopted,
          rule_types: job.adopted_rules.map(r => r.rule_type),
        }),
        rollback_available: true,
      });
    } catch (error) {
      console.error('Failed to record job history:', error);
    }
  }

  /**
   * 全ドキュメントに対して自己進化を実行
   */
  async runForAllDocuments(
    config: Partial<SelfEvolutionConfig> = {}
  ): Promise<SelfEvolutionJob[]> {
    const { data: documents } = await this.supabase
      .from('qaev_documents')
      .select('id')
      .limit(50);

    if (!documents || documents.length === 0) {
      console.log('[Self-Evolution] No documents found');
      return [];
    }

    const jobs: SelfEvolutionJob[] = [];

    for (const doc of documents) {
      const job = await this.run(doc.id, config);
      jobs.push(job);
    }

    return jobs;
  }
}
