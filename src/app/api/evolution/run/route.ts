/**
 * Evolution Run API
 * 進化プロセスをトリガーするエンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getEvolutionWorkflow } from '@/lib/evolution';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for evolution process

interface RunEvolutionRequest {
  documentId?: string; // 特定のドキュメントのみ進化させる場合
}

/**
 * POST /api/evolution/run
 * 進化プロセスを実行
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Check if user has admin role for evolution
    // For now, allow any authenticated user

    const body: RunEvolutionRequest = await request.json().catch(() => ({}));
    const { documentId } = body;

    const workflow = getEvolutionWorkflow();

    if (documentId) {
      // 特定のドキュメントの進化
      console.log(`[Evolution API] Starting evolution for document: ${documentId}`);
      const job = await workflow.evolveDocument(documentId);

      return NextResponse.json({
        success: true,
        message: 'Evolution completed for document',
        job,
      });
    } else {
      // 全対象ドキュメントの進化
      console.log('[Evolution API] Starting full evolution run');
      const jobs = await workflow.runEvolution();

      return NextResponse.json({
        success: true,
        message: `Evolution completed. Processed ${jobs.length} documents`,
        jobs,
      });
    }
  } catch (error) {
    console.error('Evolution API error:', error);
    return NextResponse.json(
      {
        error: 'Evolution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
