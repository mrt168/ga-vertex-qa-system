/**
 * Evolution Workflow
 * 進化プロセス全体を統合するオーケストレータ
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGoogleDriveSource } from '@/lib/documents/google-drive-source';
import { getMutationEngine } from './mutation-engine';
import { getEvaluationEngine } from './evaluation-engine';
import {
  EvolutionJob,
  EvolutionConfig,
  DEFAULT_EVOLUTION_CONFIG,
  FeedbackContext,
  DocumentCandidate,
  EvaluationResult,
} from './types';
import { v4 as uuidv4 } from 'uuid';

interface EvolutionTarget {
  documentId: string;
  driveFileId: string;
  fileName: string;
  content: string;
  feedbacks: FeedbackContext[];
  currentGeneration: number;
}

export class EvolutionWorkflow {
  private config: EvolutionConfig;
  private mutationEngine = getMutationEngine();
  private evaluationEngine = getEvaluationEngine();

  constructor(config: Partial<EvolutionConfig> = {}) {
    this.config = { ...DEFAULT_EVOLUTION_CONFIG, ...config };
  }

  /**
   * 進化プロセスを実行
   */
  async runEvolution(): Promise<EvolutionJob[]> {
    const supabase = await createServerSupabaseClient();
    const jobs: EvolutionJob[] = [];

    // Step 1: 進化対象のドキュメントを特定
    const targets = await this.identifyEvolutionTargets(supabase);
    console.log(`Found ${targets.length} documents eligible for evolution`);

    // Step 2: 各ドキュメントに対して進化プロセスを実行
    for (const target of targets) {
      try {
        const job = await this.processDocument(supabase, target);
        jobs.push(job);
      } catch (error) {
        console.error(`Evolution failed for document ${target.documentId}:`, error);
        jobs.push({
          id: uuidv4(),
          documentId: target.documentId,
          triggerFeedbackIds: target.feedbacks.map((f) => f.feedbackId),
          status: 'failed',
          candidates: [],
          evaluationResults: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          startedAt: new Date().toISOString(),
        });
      }
    }

    return jobs;
  }

  /**
   * 進化対象のドキュメントを特定
   */
  private async identifyEvolutionTargets(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  ): Promise<EvolutionTarget[]> {
    // 未処理の低評価フィードバックを取得
    const { data: feedbacks, error } = await supabase
      .from('qaev_feedback_logs')
      .select('*')
      .eq('rating', 'BAD')
      .eq('processed', false)
      .order('created_at', { ascending: false });

    if (error || !feedbacks) {
      console.error('Failed to fetch feedback logs:', error);
      return [];
    }

    // ドキュメントごとにフィードバックをグループ化
    const feedbackByDocument = new Map<string, FeedbackContext[]>();

    for (const fb of feedbacks) {
      if (!fb.document_id) continue;

      const docId = fb.document_id;
      if (!feedbackByDocument.has(docId)) {
        feedbackByDocument.set(docId, []);
      }
      feedbackByDocument.get(docId)!.push({
        feedbackId: fb.id,
        userQuery: fb.user_query,
        aiResponse: fb.ai_response,
        rating: fb.rating as 'GOOD' | 'BAD',
        feedbackText: fb.feedback_text || undefined,
        documentId: fb.document_id,
      });
    }

    // 閾値以上のフィードバックがあるドキュメントを抽出
    const targets: EvolutionTarget[] = [];
    const driveSource = getGoogleDriveSource();

    for (const [docId, docFeedbacks] of feedbackByDocument) {
      if (docFeedbacks.length >= this.config.badFeedbackThreshold) {
        // ドキュメント情報を取得
        const { data: doc } = await supabase
          .from('qaev_documents')
          .select('*')
          .eq('id', docId)
          .single();

        if (!doc) continue;

        // Google Driveからコンテンツを取得
        const driveDoc = await driveSource.getDocument(doc.drive_file_id);
        if (!driveDoc) continue;

        targets.push({
          documentId: doc.id,
          driveFileId: doc.drive_file_id,
          fileName: doc.file_name,
          content: driveDoc.content,
          feedbacks: docFeedbacks,
          currentGeneration: doc.generation,
        });
      }
    }

    return targets;
  }

  /**
   * 単一ドキュメントの進化プロセス
   */
  private async processDocument(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    target: EvolutionTarget
  ): Promise<EvolutionJob> {
    const jobId = uuidv4();
    const job: EvolutionJob = {
      id: jobId,
      documentId: target.documentId,
      triggerFeedbackIds: target.feedbacks.map((f) => f.feedbackId),
      status: 'generating',
      candidates: [],
      evaluationResults: [],
      startedAt: new Date().toISOString(),
    };

    console.log(`[Evolution] Starting job ${jobId} for document ${target.fileName}`);

    // Step 1: 変異（修正案）を生成
    console.log(`[Evolution] Generating mutations...`);
    const candidates = await this.mutationEngine.generateMutations(
      target.documentId,
      target.content,
      target.feedbacks
    );
    job.candidates = candidates;
    job.status = 'evaluating';

    console.log(`[Evolution] Generated ${candidates.length} candidates`);

    // Step 2: 評価用のサンプル質問を準備
    const sampleQuestions = await this.prepareSampleQuestions(supabase, target);

    // Step 3: 各候補を評価
    console.log(`[Evolution] Evaluating candidates...`);
    const evaluationResults = await this.evaluationEngine.evaluateCandidates(
      target.content,
      candidates,
      sampleQuestions
    );
    job.evaluationResults = evaluationResults;

    // Step 4: 勝者を選定
    const winner = this.selectWinner(evaluationResults);
    if (winner) {
      job.winnerCandidateId = winner.candidateId;
      console.log(
        `[Evolution] Winner selected: ${winner.candidateId} (win rate: ${winner.winRate})`
      );

      // Step 5: 自動更新が有効な場合、ドキュメントを更新
      if (this.config.autoUpdate) {
        job.status = 'updating';
        await this.updateDocument(supabase, target, winner, candidates);
      }
    } else {
      console.log(`[Evolution] No winner - original document is better or tie`);
    }

    // Step 6: フィードバックを処理済みにマーク
    await this.markFeedbacksProcessed(supabase, target.feedbacks);

    // Step 7: 進化履歴を記録
    await this.recordEvolutionHistory(supabase, target, job, winner, candidates);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * 評価用のサンプル質問を準備
   */
  private async prepareSampleQuestions(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    target: EvolutionTarget
  ): Promise<{ question: string; expectedTopics: string[] }[]> {
    // フィードバックの質問を使用
    const questions = target.feedbacks.slice(0, this.config.evaluationSampleSize).map((f) => ({
      question: f.userQuery,
      expectedTopics: [],
    }));

    // 過去の良い評価の質問も追加
    const { data: goodFeedbacks } = await supabase
      .from('qaev_feedback_logs')
      .select('user_query')
      .eq('document_id', target.documentId)
      .eq('rating', 'GOOD')
      .limit(3);

    if (goodFeedbacks) {
      for (const fb of goodFeedbacks) {
        questions.push({
          question: fb.user_query,
          expectedTopics: [],
        });
      }
    }

    return questions;
  }

  /**
   * 勝者を選定
   */
  private selectWinner(results: EvaluationResult[]): EvaluationResult | null {
    // 勝率が最も高い候補を選択
    const sortedResults = [...results].sort((a, b) => b.winRate - a.winRate);
    const topCandidate = sortedResults[0];

    // 最小勝率マージンを超えているか確認
    if (topCandidate && topCandidate.winRate >= 0.5 + this.config.minWinMargin) {
      return topCandidate;
    }

    return null;
  }

  /**
   * ドキュメントを更新（現時点ではログのみ）
   */
  private async updateDocument(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    target: EvolutionTarget,
    winner: EvaluationResult,
    candidates: DocumentCandidate[]
  ): Promise<void> {
    const winnerCandidate = candidates.find((c) => c.id === winner.candidateId);
    if (!winnerCandidate) return;

    // TODO: Google Drive APIでファイルを更新
    // 現時点ではログと履歴への記録のみ
    console.log(`[Evolution] Would update document ${target.fileName} with new content`);
    console.log(`[Evolution] New content length: ${winnerCandidate.content.length}`);

    // ドキュメントのgenerationを更新
    await supabase
      .from('qaev_documents')
      .update({
        generation: target.currentGeneration + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.documentId);
  }

  /**
   * フィードバックを処理済みにマーク
   */
  private async markFeedbacksProcessed(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    feedbacks: FeedbackContext[]
  ): Promise<void> {
    const feedbackIds = feedbacks.map((f) => f.feedbackId);

    await supabase.from('qaev_feedback_logs').update({ processed: true }).in('id', feedbackIds);
  }

  /**
   * 進化履歴を記録
   */
  private async recordEvolutionHistory(
    supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
    target: EvolutionTarget,
    job: EvolutionJob,
    winner: EvaluationResult | null,
    candidates: DocumentCandidate[]
  ): Promise<void> {
    const winnerCandidate = winner
      ? candidates.find((c) => c.id === winner.candidateId)
      : null;

    await supabase.from('qaev_evolution_history').insert({
      document_id: target.documentId,
      generation: target.currentGeneration + 1,
      mutation_type: winnerCandidate?.mutationType || 'NONE',
      win_rate: winner?.winRate || null,
      trigger_feedback_ids: job.triggerFeedbackIds,
      previous_content_snapshot: target.content.slice(0, 10000), // 最初の10000文字のみ
      new_content_snapshot: winnerCandidate?.content.slice(0, 10000) || null,
      rollback_available: true,
    });
  }

  /**
   * 特定のドキュメントに対して進化を手動実行
   */
  async evolveDocument(documentId: string): Promise<EvolutionJob> {
    const supabase = await createServerSupabaseClient();

    // ドキュメント情報を取得
    const { data: doc, error: docError } = await supabase
      .from('qaev_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // フィードバックを取得（処理済みも含む）
    const { data: feedbacks } = await supabase
      .from('qaev_feedback_logs')
      .select('*')
      .eq('document_id', documentId)
      .eq('rating', 'BAD')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!feedbacks || feedbacks.length === 0) {
      throw new Error('No feedback found for this document');
    }

    // Google Driveからコンテンツを取得
    const driveSource = getGoogleDriveSource();
    const driveDoc = await driveSource.getDocument(doc.drive_file_id);
    if (!driveDoc) {
      throw new Error('Document content not found in Google Drive');
    }

    const target: EvolutionTarget = {
      documentId: doc.id,
      driveFileId: doc.drive_file_id,
      fileName: doc.file_name,
      content: driveDoc.content,
      feedbacks: feedbacks.map((fb) => ({
        feedbackId: fb.id,
        userQuery: fb.user_query,
        aiResponse: fb.ai_response,
        rating: fb.rating as 'GOOD' | 'BAD',
        feedbackText: fb.feedback_text || undefined,
        documentId: fb.document_id,
      })),
      currentGeneration: doc.generation,
    };

    return await this.processDocument(supabase, target);
  }
}

// Singleton instance
let evolutionWorkflow: EvolutionWorkflow | null = null;

export function getEvolutionWorkflow(config?: Partial<EvolutionConfig>): EvolutionWorkflow {
  if (!evolutionWorkflow) {
    evolutionWorkflow = new EvolutionWorkflow(config);
  }
  return evolutionWorkflow;
}
