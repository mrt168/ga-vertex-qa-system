import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import {
  InterpretationEvolutionWorkflow,
  InterpretationMutationEngine,
  InterpretationEvaluationEngine,
  InterpretationEvolutionConfig,
} from '@/lib/interpretation';

export const runtime = 'nodejs';

interface RunEvolutionRequest {
  documentId?: string; // If provided, run for specific document
  config?: Partial<InterpretationEvolutionConfig>;
}

// POST /api/interpretation/evolution/run - Run interpretation rule evolution
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

    const body: RunEvolutionRequest = await request.json().catch(() => ({}));
    const { documentId, config } = body;

    // Initialize components
    const geminiClient = getVertexGeminiClient();
    const mutationEngine = new InterpretationMutationEngine(geminiClient);
    const evaluationEngine = new InterpretationEvaluationEngine(geminiClient);
    const evolutionWorkflow = new InterpretationEvolutionWorkflow(
      supabase,
      mutationEngine,
      evaluationEngine
    );

    let jobs;

    if (documentId) {
      // Run for specific document
      const job = await evolutionWorkflow.runForDocument(documentId, config);
      jobs = job ? [job] : [];
    } else {
      // Run for all eligible documents
      jobs = await evolutionWorkflow.run(config);
    }

    return NextResponse.json({
      success: true,
      jobs_count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        document_id: job.document_id,
        status: job.status,
        candidates_count: job.candidates.length,
        adopted_rules_count: job.adopted_rules.length,
        error: job.error,
      })),
    });
  } catch (error) {
    console.error('Interpretation evolution API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
