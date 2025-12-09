import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { InterpretationService } from '@/lib/interpretation';

export const runtime = 'nodejs';

// GET /api/interpretation/stats - Get interpretation layer statistics
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

    const interpretationService = new InterpretationService(supabase);
    const stats = await interpretationService.getStats();

    // Get additional detailed stats
    const detailedStats = await getDetailedStats(supabase);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        ...detailedStats,
      },
    });
  } catch (error) {
    console.error('Interpretation stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getDetailedStats(supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never) {
  // Get rule type distribution
  const { data: rulesByType } = await supabase
    .from('qa_interpretation_rules')
    .select('rule_type');

  const typeDistribution: Record<string, number> = {};
  if (rulesByType) {
    for (const rule of rulesByType) {
      typeDistribution[rule.rule_type] = (typeDistribution[rule.rule_type] || 0) + 1;
    }
  }

  // Get top performing rules
  const { data: topRules } = await supabase
    .from('qa_interpretation_rules')
    .select('id, document_id, rule_type, content, score')
    .eq('enabled', true)
    .order('score', { ascending: false })
    .limit(10);

  // Get rules by document
  const { data: rulesByDocument } = await supabase
    .from('qa_interpretation_rules')
    .select('document_id')
    .eq('enabled', true);

  const documentDistribution: Record<string, number> = {};
  if (rulesByDocument) {
    for (const rule of rulesByDocument) {
      documentDistribution[rule.document_id] = (documentDistribution[rule.document_id] || 0) + 1;
    }
  }

  // Get recent applications
  const { data: recentApplications, count: totalApplications } = await supabase
    .from('qa_interpretation_applications')
    .select('*', { count: 'exact' })
    .order('applied_at', { ascending: false })
    .limit(10);

  // Get evolution history summary
  const { data: evolutionHistory, count: totalEvolutions } = await supabase
    .from('qaev_evolution_history')
    .select('*', { count: 'exact' })
    .ilike('mutation_type', 'INTERPRETATION_%')
    .order('created_at', { ascending: false })
    .limit(10);

  // Calculate average win rate from evolution history
  let avgWinRate = 0;
  if (evolutionHistory && evolutionHistory.length > 0) {
    const totalWinRate = evolutionHistory.reduce(
      (sum, h) => sum + (h.win_rate || 0),
      0
    );
    avgWinRate = totalWinRate / evolutionHistory.length;
  }

  return {
    type_distribution: typeDistribution,
    document_distribution: documentDistribution,
    top_performing_rules: topRules || [],
    recent_applications: recentApplications || [],
    total_applications: totalApplications || 0,
    evolution_summary: {
      total_evolutions: totalEvolutions || 0,
      recent_evolutions: evolutionHistory || [],
      average_win_rate: avgWinRate,
    },
  };
}
