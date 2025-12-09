import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import { SelfEvolutionWorkflow } from '@/lib/interpretation/self-evolution-workflow';
import { SelfEvolutionConfig, DEFAULT_SELF_EVOLUTION_CONFIG } from '@/lib/interpretation/types';

export const runtime = 'nodejs';

interface SelfRunRequest {
  documentId?: string; // If provided, run for specific document
  runForAll?: boolean; // If true, run for all documents
  config?: Partial<SelfEvolutionConfig>;
}

// POST /api/interpretation/evolution/self-run - Run self-evolution (AI-driven improvement)
export async function POST(request: NextRequest) {
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

    const body: SelfRunRequest = await request.json().catch(() => ({}));
    const { documentId, runForAll, config } = body;

    // Validate request
    if (!documentId && !runForAll) {
      return NextResponse.json(
        { error: 'Either documentId or runForAll must be specified' },
        { status: 400 }
      );
    }

    // Initialize workflow
    const geminiClient = getVertexGeminiClient();
    const workflow = new SelfEvolutionWorkflow(supabase, geminiClient);

    const fullConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...config };

    if (runForAll) {
      // Run for all documents
      const jobs = await workflow.runForAllDocuments(fullConfig);

      return NextResponse.json({
        success: true,
        mode: 'all_documents',
        jobs_count: jobs.length,
        summary: {
          total_questions_generated: jobs.reduce((sum, j) => sum + j.metrics.questions_generated, 0),
          total_weaknesses_found: jobs.reduce((sum, j) => sum + j.metrics.weaknesses_found, 0),
          total_rules_adopted: jobs.reduce((sum, j) => sum + j.metrics.rules_adopted, 0),
          completed: jobs.filter(j => j.status === 'completed').length,
          failed: jobs.filter(j => j.status === 'failed').length,
        },
        jobs: jobs.map(job => ({
          id: job.id,
          document_id: job.document_id,
          status: job.status,
          metrics: job.metrics,
          error: job.error,
        })),
      });
    } else if (documentId) {
      // Run for specific document
      const job = await workflow.run(documentId, fullConfig);

      return NextResponse.json({
        success: true,
        mode: 'single_document',
        job: {
          id: job.id,
          document_id: job.document_id,
          status: job.status,
          metrics: job.metrics,
          synthetic_questions: job.synthetic_questions.map(q => ({
            question: q.question,
            category: q.category,
            difficulty: q.difficulty,
          })),
          identified_weaknesses: job.identified_weaknesses.map(w => ({
            type: w.type,
            description: w.description,
            suggested_rule_type: w.suggested_rule_type,
            confidence: w.confidence,
          })),
          adopted_rules: job.adopted_rules.map(r => ({
            id: r.id,
            rule_type: r.rule_type,
            content: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
            score: r.score,
          })),
          error: job.error,
          started_at: job.started_at,
          completed_at: job.completed_at,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Self-evolution API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/interpretation/evolution/self-run - Get self-evolution status and history
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

    // Get self-evolution history
    const { data: history, error } = await supabase
      .from('qaev_evolution_history')
      .select('*')
      .eq('mutation_type', 'SELF_EVOLUTION')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch self-evolution history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      history: history || [],
      total_count: history?.length || 0,
    });
  } catch (error) {
    console.error('Self-evolution status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
