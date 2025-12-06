/**
 * Evolution History API
 * 進化履歴を取得するエンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/evolution/history
 * 進化履歴を取得
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
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('qaev_evolution_history')
      .select(
        `
        *,
        document:qaev_documents(id, file_name)
      `
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Failed to fetch evolution history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Evolution history API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
