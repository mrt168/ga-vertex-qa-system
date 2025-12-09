import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

interface UpdateRuleRequest {
  enabled?: boolean;
  content?: string;
  trigger_pattern?: string | null;
}

// GET /api/interpretation/rules/[id] - Get a specific rule
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: rule, error } = await supabase
      .from('qa_interpretation_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    // Get application stats
    const { count: applicationCount } = await supabase
      .from('qa_interpretation_applications')
      .select('*', { count: 'exact', head: true })
      .eq('rule_id', id);

    return NextResponse.json({
      success: true,
      rule,
      stats: {
        application_count: applicationCount || 0,
      },
    });
  } catch (error) {
    console.error('Get rule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/interpretation/rules/[id] - Update a rule
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateRuleRequest = await request.json();

    // Validate request
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.enabled !== undefined) {
      updateData.enabled = body.enabled;
    }

    if (body.content !== undefined) {
      if (body.content.trim() === '') {
        return NextResponse.json(
          { error: 'Content cannot be empty' },
          { status: 400 }
        );
      }
      updateData.content = body.content;
    }

    if (body.trigger_pattern !== undefined) {
      updateData.trigger_pattern = body.trigger_pattern;
    }

    const { data: rule, error } = await supabase
      .from('qa_interpretation_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update rule:', error);
      return NextResponse.json(
        { error: 'Failed to update rule' },
        { status: 500 }
      );
    }

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Update rule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/interpretation/rules/[id] - Delete a rule
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, delete application records
    await supabase
      .from('qa_interpretation_applications')
      .delete()
      .eq('rule_id', id);

    // Then delete the rule
    const { error } = await supabase
      .from('qa_interpretation_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete rule:', error);
      return NextResponse.json(
        { error: 'Failed to delete rule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Delete rule API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
