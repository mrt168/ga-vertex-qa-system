import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InterpretationService } from '@/lib/interpretation';

export const runtime = 'nodejs';

interface FeedbackRequest {
  messageId: string;
  rating: 'GOOD' | 'BAD';
  feedbackText?: string;
}

// POST /api/qa/feedback - Submit feedback for a message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: FeedbackRequest = await request.json();
    const { messageId, rating, feedbackText } = body;

    if (!messageId || !rating) {
      return NextResponse.json(
        { error: 'messageId and rating are required' },
        { status: 400 }
      );
    }

    if (rating !== 'GOOD' && rating !== 'BAD') {
      return NextResponse.json(
        { error: 'Rating must be GOOD or BAD' },
        { status: 400 }
      );
    }

    // Get the message with its session to verify ownership
    const { data: message, error: msgError } = await supabase
      .from('qa_messages')
      .select(`
        id,
        content,
        session_id,
        qa_sessions!inner (
          user_id
        )
      `)
      .eq('id', messageId)
      .eq('role', 'assistant')
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Verify the session belongs to the user
    const sessionData = message.qa_sessions as unknown as { user_id: string };
    if (sessionData.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user's question (previous message in session)
    const { data: userMessages } = await supabase
      .from('qa_messages')
      .select('content')
      .eq('session_id', message.session_id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1);

    const userQuery = userMessages?.[0]?.content || '';

    // Check if feedback already exists for this message
    const { data: existingFeedback } = await supabase
      .from('qa_feedback_logs')
      .select('id')
      .eq('message_id', messageId)
      .single();

    // Initialize InterpretationService for rule score updates
    const interpretationService = new InterpretationService(supabase);

    if (existingFeedback) {
      // Update existing feedback
      const { data: feedback, error: updateError } = await supabase
        .from('qa_feedback_logs')
        .update({
          rating,
          feedback_text: feedbackText || null,
        })
        .eq('id', existingFeedback.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update feedback:', updateError);
        return NextResponse.json(
          { error: 'Failed to update feedback' },
          { status: 500 }
        );
      }

      // Update interpretation rule scores based on feedback
      try {
        await interpretationService.updateRuleScores(messageId, rating);
      } catch (ruleError) {
        // Non-critical: log but don't fail the request
        console.warn('Failed to update interpretation rule scores:', ruleError);
      }

      return NextResponse.json({ feedback });
    }

    // Create new feedback
    const { data: feedback, error: insertError } = await supabase
      .from('qa_feedback_logs')
      .insert({
        user_id: user.id,
        message_id: messageId,
        user_query: userQuery,
        ai_response: message.content,
        rating,
        feedback_text: feedbackText || null,
        processed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create feedback:', insertError);
      return NextResponse.json(
        { error: 'Failed to create feedback' },
        { status: 500 }
      );
    }

    // Update message with feedback_id
    await supabase
      .from('qa_messages')
      .update({ feedback_id: feedback.id })
      .eq('id', messageId);

    // Update interpretation rule scores based on feedback
    try {
      await interpretationService.updateRuleScores(messageId, rating);
    } catch (ruleError) {
      // Non-critical: log but don't fail the request
      console.warn('Failed to update interpretation rule scores:', ruleError);
    }

    // If BAD feedback, check if we should trigger evolution
    if (rating === 'BAD') {
      await checkEvolutionTrigger(supabase, feedback.document_id);
    }

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function checkEvolutionTrigger(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  documentId: string | null
) {
  if (!documentId) return;

  // Count unprocessed BAD feedback for this document
  const { count } = await supabase
    .from('qa_feedback_logs')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .eq('rating', 'BAD')
    .eq('processed', false);

  // Trigger evolution if threshold reached (3+ bad feedbacks)
  if (count && count >= 3) {
    // TODO: Trigger evolution process via Cloud Workflows or background job
    console.log(`Evolution triggered for document ${documentId} with ${count} bad feedbacks`);

    // For now, just mark feedbacks as processed
    await supabase
      .from('qa_feedback_logs')
      .update({ processed: true })
      .eq('document_id', documentId)
      .eq('rating', 'BAD')
      .eq('processed', false);

    // Update document bad count
    await supabase
      .from('qa_documents')
      .update({
        total_bad_count: count,
      })
      .eq('id', documentId);
  }
}
