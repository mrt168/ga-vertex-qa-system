/**
 * Evolution Stats API
 * 進化統計情報を取得するエンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { DEFAULT_EVOLUTION_CONFIG } from '@/lib/evolution/types';

export const runtime = 'nodejs';

/**
 * GET /api/evolution/stats
 * 進化関連の統計情報を取得
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

    // 未処理の低評価フィードバック数
    const { count: pendingBadFeedbackCount } = await supabase
      .from('qa_feedback_logs')
      .select('*', { count: 'exact', head: true })
      .eq('rating', 'BAD')
      .eq('processed', false);

    // 全フィードバック数
    const { count: totalFeedbackCount } = await supabase
      .from('qa_feedback_logs')
      .select('*', { count: 'exact', head: true });

    // 良い評価の数
    const { count: goodFeedbackCount } = await supabase
      .from('qa_feedback_logs')
      .select('*', { count: 'exact', head: true })
      .eq('rating', 'GOOD');

    // 低評価でグループ化してドキュメント数を確認
    const { data: feedbackByDoc } = await supabase
      .from('qa_feedback_logs')
      .select('document_id')
      .eq('rating', 'BAD')
      .eq('processed', false);

    // ドキュメントごとのカウント
    const docFeedbackCounts = new Map<string, number>();
    for (const fb of feedbackByDoc || []) {
      if (fb.document_id) {
        const count = docFeedbackCounts.get(fb.document_id) || 0;
        docFeedbackCounts.set(fb.document_id, count + 1);
      }
    }

    // 進化対象（閾値以上のフィードバック）のドキュメント数
    const eligibleDocuments = Array.from(docFeedbackCounts.entries()).filter(
      ([, count]) => count >= DEFAULT_EVOLUTION_CONFIG.badFeedbackThreshold
    );

    // 進化履歴数
    const { count: evolutionCount } = await supabase
      .from('qa_evolution_history')
      .select('*', { count: 'exact', head: true });

    // 成功した進化（勝者あり）
    const { count: successfulEvolutions } = await supabase
      .from('qa_evolution_history')
      .select('*', { count: 'exact', head: true })
      .not('win_rate', 'is', null);

    // ドキュメント数
    const { count: documentCount } = await supabase
      .from('qa_documents')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      stats: {
        feedback: {
          total: totalFeedbackCount || 0,
          good: goodFeedbackCount || 0,
          bad: (totalFeedbackCount || 0) - (goodFeedbackCount || 0),
          pendingBad: pendingBadFeedbackCount || 0,
        },
        evolution: {
          eligibleDocuments: eligibleDocuments.length,
          eligibleDocumentIds: eligibleDocuments.map(([id]) => id),
          totalEvolutions: evolutionCount || 0,
          successfulEvolutions: successfulEvolutions || 0,
          threshold: DEFAULT_EVOLUTION_CONFIG.badFeedbackThreshold,
        },
        documents: {
          total: documentCount || 0,
        },
      },
    });
  } catch (error) {
    console.error('Evolution stats API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
