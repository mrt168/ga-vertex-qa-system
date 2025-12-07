/**
 * Admin QA Logs API
 * 質問と回答の履歴を取得するエンドポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/admin/qa-logs
 * Q&Aログを取得
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const rating = searchParams.get('rating'); // 'GOOD', 'BAD', or null for all

    // Use service role client for data fetching (bypasses RLS)
    // Falls back to regular client if service role key is not set
    let adminClient;
    try {
      adminClient = createServiceRoleClient();
    } catch (e) {
      console.warn('Service role key not set, falling back to regular client. Admin will only see their own sessions.');
      adminClient = supabase;
    }

    // Get sessions with their messages
    const { data: sessions, error: sessionsError } = await adminClient
      .from('qa_sessions')
      .select(`
        id,
        title,
        created_at,
        updated_at,
        qa_messages (
          id,
          role,
          content,
          created_at,
          feedback_id
        )
      `)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionsError) {
      console.error('Failed to fetch sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Get feedbacks with optional rating filter
    let feedbackQuery = adminClient
      .from('qa_feedback_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (rating) {
      feedbackQuery = feedbackQuery.eq('rating', rating);
    }

    const { data: feedbacks, error: feedbackError } = await feedbackQuery;

    if (feedbackError) {
      console.error('Failed to fetch feedbacks:', feedbackError);
    }

    // Create Q&A pairs from sessions
    const qaPairs: Array<{
      id: string;
      sessionId: string;
      sessionTitle: string | null;
      question: string;
      answer: string;
      rating: 'GOOD' | 'BAD' | null;
      feedbackText: string | null;
      createdAt: string;
    }> = [];

    for (const session of sessions || []) {
      const messages = (session.qa_messages as Array<{
        id: string;
        role: string;
        content: string;
        created_at: string;
        feedback_id: string | null;
      }>) || [];

      // Sort messages by created_at
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Pair user messages with assistant responses
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'user') {
          // Find the next assistant message
          const assistantMsg = messages.find(
            (m, idx) => idx > i && m.role === 'assistant'
          );

          if (assistantMsg) {
            // Find feedback for this assistant message
            const feedback = feedbacks?.find(f => f.message_id === assistantMsg.id);

            // Apply rating filter if specified
            if (rating && (!feedback || feedback.rating !== rating)) {
              continue;
            }

            qaPairs.push({
              id: assistantMsg.id,
              sessionId: session.id,
              sessionTitle: session.title,
              question: msg.content,
              answer: assistantMsg.content,
              rating: feedback?.rating || null,
              feedbackText: feedback?.feedback_text || null,
              createdAt: msg.created_at,
            });
          }
        }
      }
    }

    // Sort by createdAt descending
    qaPairs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get total count for pagination
    const { count: totalSessions } = await adminClient
      .from('qa_sessions')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      qaPairs: qaPairs.slice(0, limit),
      pagination: {
        total: totalSessions || 0,
        offset,
        limit,
      },
    });
  } catch (error) {
    console.error('Admin QA logs API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
