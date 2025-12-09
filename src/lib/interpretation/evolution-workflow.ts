/**
 * Interpretation Evolution Workflow
 * 解釈ルールの進化プロセスを統括
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { InterpretationService } from './interpretation-service';
import { InterpretationMutationEngine } from './mutation-engine';
import { InterpretationEvaluationEngine } from './evaluation-engine';
import {
  InterpretationEvolutionConfig,
  InterpretationEvolutionJob,
  InterpretationRule,
  InterpretationCandidate,
  DEFAULT_INTERPRETATION_EVOLUTION_CONFIG,
} from './types';
import { DocumentContentService } from '@/lib/documents/document-content-service';

interface FeedbackLog {
  id: string;
  document_id: string | null;
  user_query: string;
  ai_response: string;
  feedback_text: string | null;
}

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

export class InterpretationEvolutionWorkflow {
  private interpretationService: InterpretationService;
  private mutationEngine: InterpretationMutationEngine;
  private evaluationEngine: InterpretationEvaluationEngine;
  private documentContentService: DocumentContentService;

  constructor(
    private supabase: SupabaseClient,
    mutationEngine: InterpretationMutationEngine,
    evaluationEngine: InterpretationEvaluationEngine
  ) {
    this.interpretationService = new InterpretationService(supabase);
    this.mutationEngine = mutationEngine;
    this.evaluationEngine = evaluationEngine;
    this.documentContentService = new DocumentContentService(supabase);
  }

  /**
   * 進化プロセスを実行
   */
  async run(
    config: Partial<InterpretationEvolutionConfig> = {}
  ): Promise<InterpretationEvolutionJob[]> {
    const fullConfig = { ...DEFAULT_INTERPRETATION_EVOLUTION_CONFIG, ...config };
    const jobs: InterpretationEvolutionJob[] = [];

    // 1. 進化対象のドキュメントを特定
    const targets = await this.identifyEvolutionTargets(fullConfig);

    if (targets.length === 0) {
      console.log('No documents require interpretation rule evolution');
      return jobs;
    }

    // 2. 各ドキュメントについて進化プロセスを実行
    for (const target of targets) {
      const job = await this.processDocument(target, fullConfig);
      jobs.push(job);
    }

    return jobs;
  }

  /**
   * 進化対象のドキュメントを特定
   */
  private async identifyEvolutionTargets(
    config: InterpretationEvolutionConfig
  ): Promise<
    Array<{
      documentId: string;
      feedbacks: FeedbackLog[];
    }>
  > {
    // 未処理の低評価フィードバックを取得
    const { data: feedbacks, error } = await this.supabase
      .from('qaev_feedback_logs')
      .select('*')
      .eq('rating', 'BAD')
      .eq('processed', false)
      .not('document_id', 'is', null);

    if (error || !feedbacks) {
      console.error('Failed to fetch feedbacks:', error);
      return [];
    }

    // ドキュメントごとにグループ化
    const feedbacksByDoc = new Map<string, FeedbackLog[]>();
    for (const fb of feedbacks as FeedbackLog[]) {
      if (fb.document_id) {
        const existing = feedbacksByDoc.get(fb.document_id) || [];
        existing.push(fb);
        feedbacksByDoc.set(fb.document_id, existing);
      }
    }

    // 閾値以上のドキュメントを抽出
    const targets: Array<{ documentId: string; feedbacks: FeedbackLog[] }> = [];
    for (const [documentId, docFeedbacks] of feedbacksByDoc) {
      if (docFeedbacks.length >= config.badFeedbackThreshold) {
        targets.push({ documentId, feedbacks: docFeedbacks });
      }
    }

    return targets;
  }

  /**
   * ドキュメント単位で進化プロセスを実行
   */
  private async processDocument(
    target: { documentId: string; feedbacks: FeedbackLog[] },
    config: InterpretationEvolutionConfig
  ): Promise<InterpretationEvolutionJob> {
    const jobId = uuidv4();
    const startedAt = new Date().toISOString();

    const job: InterpretationEvolutionJob = {
      id: jobId,
      document_id: target.documentId,
      trigger_feedback_ids: target.feedbacks.map((f) => f.id),
      status: 'pending',
      candidates: [],
      evaluation_results: [],
      adopted_rules: [],
      started_at: startedAt,
    };

    try {
      // 1. ドキュメント内容を取得
      job.status = 'generating';
      const document = await this.getDocumentContent(target.documentId);

      if (!document) {
        throw new Error(`Document not found: ${target.documentId}`);
      }

      // 2. 解釈ルール候補を生成
      const feedbacksForMutation = target.feedbacks.map((f) => ({
        user_query: f.user_query,
        ai_response: f.ai_response,
        feedback_text: f.feedback_text || undefined,
      }));

      const candidates = await this.mutationEngine.generateRuleCandidates(
        document,
        feedbacksForMutation
      );

      job.candidates = candidates;

      if (candidates.length === 0) {
        console.log(`No candidates generated for document ${target.documentId}`);
        job.status = 'completed';
        job.completed_at = new Date().toISOString();
        return job;
      }

      // 3. サンプル質問を準備
      job.status = 'evaluating';
      const sampleQuestions = await this.prepareSampleQuestions(
        target.feedbacks,
        config.evaluationSampleSize
      );

      // 4. 候補を評価
      const evaluationResults = await this.evaluationEngine.evaluateCandidates(
        document,
        candidates,
        sampleQuestions
      );

      job.evaluation_results = evaluationResults;

      // 5. 勝率が閾値以上の候補を採用
      const currentGeneration = await this.interpretationService.getCurrentGeneration(
        target.documentId
      );
      const nextGeneration = currentGeneration + 1;

      const adoptedRules: InterpretationRule[] = [];

      for (const result of evaluationResults) {
        if (result.win_rate >= config.minWinRate) {
          // ルールを作成
          const rule = await this.interpretationService.createRule({
            document_id: target.documentId,
            rule_type: result.candidate.rule_type,
            content: result.candidate.content,
            trigger_pattern: result.candidate.trigger_pattern || null,
            generation: nextGeneration,
            score: result.avg_score / 5, // Normalize to 0-1
            enabled: config.autoEnable,
            source_feedback_ids: target.feedbacks.map((f) => f.id),
          });

          if (rule) {
            adoptedRules.push(rule);
          }
        }
      }

      job.adopted_rules = adoptedRules;

      // 6. フィードバックを処理済みにマーク
      await this.markFeedbacksProcessed(target.feedbacks.map((f) => f.id));

      // 7. 進化履歴を記録
      await this.recordEvolutionHistory(job, document);

      job.status = 'completed';
      job.completed_at = new Date().toISOString();

      console.log(
        `Evolution completed for ${target.documentId}: ${adoptedRules.length} rules adopted`
      );

      return job;
    } catch (error) {
      console.error(`Evolution failed for ${target.documentId}:`, error);
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
   * サンプル質問を準備
   */
  private async prepareSampleQuestions(
    feedbacks: FeedbackLog[],
    sampleSize: number
  ): Promise<string[]> {
    // フィードバックの質問を使用
    const questions = feedbacks.map((f) => f.user_query);

    // 重複を除去
    const uniqueQuestions = [...new Set(questions)];

    // サンプルサイズに合わせて調整
    if (uniqueQuestions.length >= sampleSize) {
      return uniqueQuestions.slice(0, sampleSize);
    }

    // 不足分は過去の良い評価のQ&Aから補充
    const { data: goodFeedbacks } = await this.supabase
      .from('qaev_feedback_logs')
      .select('user_query')
      .eq('rating', 'GOOD')
      .limit(sampleSize - uniqueQuestions.length);

    if (goodFeedbacks) {
      for (const fb of goodFeedbacks) {
        if (!uniqueQuestions.includes(fb.user_query)) {
          uniqueQuestions.push(fb.user_query);
        }
        if (uniqueQuestions.length >= sampleSize) {
          break;
        }
      }
    }

    return uniqueQuestions;
  }

  /**
   * フィードバックを処理済みにマーク
   */
  private async markFeedbacksProcessed(feedbackIds: string[]): Promise<void> {
    await this.supabase
      .from('qaev_feedback_logs')
      .update({ processed: true })
      .in('id', feedbackIds);
  }

  /**
   * 進化履歴を記録
   */
  private async recordEvolutionHistory(
    job: InterpretationEvolutionJob,
    document: DocumentContent
  ): Promise<void> {
    // 採用されたルールごとに履歴を記録
    for (const rule of job.adopted_rules) {
      const result = job.evaluation_results.find(
        (r) =>
          r.candidate.rule_type === rule.rule_type &&
          r.candidate.content === rule.content
      );

      await this.supabase.from('qaev_evolution_history').insert({
        document_id: job.document_id,
        generation: rule.generation,
        mutation_type: `INTERPRETATION_${rule.rule_type}`,
        win_rate: result?.win_rate || 0,
        trigger_feedback_ids: job.trigger_feedback_ids,
        previous_content_snapshot: document.content.slice(0, 10000),
        new_content_snapshot: `[Interpretation Rule] ${rule.content}`,
        rollback_available: true,
      });
    }
  }

  /**
   * 特定のドキュメントに対して進化を実行
   */
  async runForDocument(
    documentId: string,
    config: Partial<InterpretationEvolutionConfig> = {}
  ): Promise<InterpretationEvolutionJob | null> {
    const fullConfig = { ...DEFAULT_INTERPRETATION_EVOLUTION_CONFIG, ...config };

    // ドキュメントのフィードバックを取得
    const { data: feedbacks } = await this.supabase
      .from('qaev_feedback_logs')
      .select('*')
      .eq('document_id', documentId)
      .eq('rating', 'BAD')
      .eq('processed', false);

    if (!feedbacks || feedbacks.length === 0) {
      console.log(`No unprocessed BAD feedbacks for document ${documentId}`);
      return null;
    }

    return this.processDocument(
      { documentId, feedbacks: feedbacks as FeedbackLog[] },
      fullConfig
    );
  }
}
