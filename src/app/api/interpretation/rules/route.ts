import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface RuleQueryParams {
  document_id?: string;
  rule_type?: string;
  enabled?: string;
  limit?: string;
  offset?: string;
}

// GET /api/interpretation/rules - List interpretation rules
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params: RuleQueryParams = {
      document_id: searchParams.get('document_id') || undefined,
      rule_type: searchParams.get('rule_type') || undefined,
      enabled: searchParams.get('enabled') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    };

    // Build query
    let query = supabase
      .from('qa_interpretation_rules')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.document_id) {
      query = query.eq('document_id', params.document_id);
    }

    if (params.rule_type) {
      query = query.eq('rule_type', params.rule_type);
    }

    if (params.enabled !== undefined) {
      query = query.eq('enabled', params.enabled === 'true');
    }

    // Apply pagination
    const limit = Math.min(parseInt(params.limit || '50'), 100);
    const offset = parseInt(params.offset || '0');

    query = query
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rules, error, count } = await query;

    if (error) {
      console.error('Failed to fetch interpretation rules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch rules' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rules: rules || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Interpretation rules API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
