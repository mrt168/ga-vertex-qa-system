/**
 * Evolution Candidates API
 * 進化候補を取得・管理するエンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/evolution/candidates
 * 進化候補を取得（未適用の候補を含む）
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    // 進化履歴から最新の候補を取得
    let query = supabase
      .from('qa_evolution_history')
      .select(
        `
        *,
        document:qa_documents(id, file_name, drive_file_id)
      `
      )
      .order('created_at', { ascending: false })
      .limit(20);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { data: candidates, error } = await query;

    if (error) {
      console.error('Failed to fetch evolution candidates:', error);
      return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error('Evolution candidates API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
