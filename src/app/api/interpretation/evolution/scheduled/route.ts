/**
 * Scheduled Evolution API
 * Cloud Schedulerから定期的に呼び出される進化実行エンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import { SelfEvolutionWorkflow } from '@/lib/interpretation/self-evolution-workflow';
import { InterpretationEvolutionWorkflow } from '@/lib/interpretation/evolution-workflow';
import { InterpretationMutationEngine } from '@/lib/interpretation/mutation-engine';
import { InterpretationEvaluationEngine } from '@/lib/interpretation/evaluation-engine';
import {
  SelfEvolutionConfig,
  DEFAULT_SELF_EVOLUTION_CONFIG,
  InterpretationEvolutionConfig,
  DEFAULT_INTERPRETATION_EVOLUTION_CONFIG,
} from '@/lib/interpretation/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for scheduled tasks

// API Key for Cloud Scheduler authentication
const SCHEDULER_API_KEY = process.env.EVOLUTION_SCHEDULER_API_KEY;

interface ScheduledRequest {
  mode?: 'self_evolution' | 'feedback_evolution' | 'both';
  documentIds?: string[]; // If provided, run for specific documents only
  selfEvolutionConfig?: Partial<SelfEvolutionConfig>;
  feedbackEvolutionConfig?: Partial<InterpretationEvolutionConfig>;
}

interface EvolutionSummary {
  mode: string;
  self_evolution?: {
    documents_processed: number;
    total_questions_generated: number;
    total_weaknesses_found: number;
    total_rules_adopted: number;
    completed: number;
    failed: number;
  };
  feedback_evolution?: {
    documents_processed: number;
    total_candidates_generated: number;
    total_rules_adopted: number;
    completed: number;
    failed: number;
  };
  executed_at: string;
  duration_ms: number;
}

// POST /api/interpretation/evolution/scheduled - Run scheduled evolution
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate request (either API key for Cloud Scheduler or user session)
    const apiKey = request.headers.get('x-api-key');
    const supabase = await createServerSupabaseClient();

    if (apiKey) {
      // API Key authentication for Cloud Scheduler
      if (!SCHEDULER_API_KEY || apiKey !== SCHEDULER_API_KEY) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }
    } else {
      // User session authentication for manual trigger
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body: ScheduledRequest = await request.json().catch(() => ({}));
    const {
      mode = 'both',
      documentIds,
      selfEvolutionConfig,
      feedbackEvolutionConfig,
    } = body;

    const geminiClient = getVertexGeminiClient();
    const summary: EvolutionSummary = {
      mode,
      executed_at: new Date().toISOString(),
      duration_ms: 0,
    };

    // Self Evolution
    if (mode === 'self_evolution' || mode === 'both') {
      const selfWorkflow = new SelfEvolutionWorkflow(supabase, geminiClient);
      const selfConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...selfEvolutionConfig };

      let selfJobs;
      if (documentIds && documentIds.length > 0) {
        // Run for specific documents
        selfJobs = await Promise.all(
          documentIds.map(id => selfWorkflow.run(id, selfConfig))
        );
      } else {
        // Run for all documents
        selfJobs = await selfWorkflow.runForAllDocuments(selfConfig);
      }

      summary.self_evolution = {
        documents_processed: selfJobs.length,
        total_questions_generated: selfJobs.reduce((sum, j) => sum + j.metrics.questions_generated, 0),
        total_weaknesses_found: selfJobs.reduce((sum, j) => sum + j.metrics.weaknesses_found, 0),
        total_rules_adopted: selfJobs.reduce((sum, j) => sum + j.metrics.rules_adopted, 0),
        completed: selfJobs.filter(j => j.status === 'completed').length,
        failed: selfJobs.filter(j => j.status === 'failed').length,
      };

      console.log('[Scheduled Evolution] Self-evolution completed:', summary.self_evolution);
    }

    // Feedback Evolution
    if (mode === 'feedback_evolution' || mode === 'both') {
      const mutationEngine = new InterpretationMutationEngine(geminiClient);
      const evaluationEngine = new InterpretationEvaluationEngine(geminiClient);
      const feedbackWorkflow = new InterpretationEvolutionWorkflow(
        supabase,
        mutationEngine,
        evaluationEngine
      );
      const feedbackConfig = { ...DEFAULT_INTERPRETATION_EVOLUTION_CONFIG, ...feedbackEvolutionConfig };

      let feedbackJobs;
      if (documentIds && documentIds.length > 0) {
        // Run for specific documents
        feedbackJobs = await Promise.all(
          documentIds.map(id => feedbackWorkflow.runForDocument(id, feedbackConfig))
        );
        feedbackJobs = feedbackJobs.filter(Boolean); // Remove nulls
      } else {
        // Run for all documents with unprocessed feedback
        feedbackJobs = await feedbackWorkflow.run(feedbackConfig);
      }

      summary.feedback_evolution = {
        documents_processed: feedbackJobs.length,
        total_candidates_generated: feedbackJobs.reduce(
          (sum, j) => sum + (j?.candidates?.length || 0),
          0
        ),
        total_rules_adopted: feedbackJobs.reduce(
          (sum, j) => sum + (j?.adopted_rules?.length || 0),
          0
        ),
        completed: feedbackJobs.filter(j => j?.status === 'completed').length,
        failed: feedbackJobs.filter(j => j?.status === 'failed').length,
      };

      console.log('[Scheduled Evolution] Feedback evolution completed:', summary.feedback_evolution);
    }

    summary.duration_ms = Date.now() - startTime;

    // Record execution log
    await recordScheduledExecutionLog(supabase, summary);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Scheduled evolution API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET /api/interpretation/evolution/scheduled - Get scheduled execution history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get scheduled execution logs
    const { data: logs, error, count } = await supabase
      .from('qa_scheduled_evolution_logs')
      .select('*', { count: 'exact' })
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // Table might not exist yet
      console.error('Failed to fetch scheduled execution logs:', error);
      return NextResponse.json({
        success: true,
        logs: [],
        total_count: 0,
        message: 'No execution history found',
      });
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
      total_count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Scheduled evolution history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Record scheduled execution log
 */
async function recordScheduledExecutionLog(
  supabase: any,
  summary: EvolutionSummary
): Promise<void> {
  try {
    await supabase.from('qa_scheduled_evolution_logs').insert({
      mode: summary.mode,
      self_evolution_summary: summary.self_evolution || null,
      feedback_evolution_summary: summary.feedback_evolution || null,
      executed_at: summary.executed_at,
      duration_ms: summary.duration_ms,
    });
  } catch (error) {
    console.error('Failed to record scheduled execution log:', error);
    // Non-critical error, don't throw
  }
}
