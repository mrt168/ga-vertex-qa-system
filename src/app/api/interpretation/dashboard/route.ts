/**
 * Evolution Dashboard API
 * 進化プロセスの統計・モニタリングダッシュボード
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface DashboardStats {
  overview: {
    total_documents: number;
    total_rules: number;
    enabled_rules: number;
    total_evolution_runs: number;
    total_scheduled_runs: number;
  };
  rule_stats: {
    by_type: Record<string, number>;
    by_generation: Record<string, number>;
    avg_score: number;
  };
  evolution_stats: {
    total_mutations: number;
    avg_win_rate: number;
    mutation_types: Record<string, number>;
  };
  recent_activity: {
    recent_rules: Array<{
      id: string;
      document_id: string;
      document_name?: string;
      rule_type: string;
      score: number;
      created_at: string;
    }>;
    recent_evolutions: Array<{
      id: string;
      document_id: string;
      document_name?: string;
      mutation_type: string;
      win_rate: number | null;
      created_at: string;
    }>;
  };
  document_performance: Array<{
    id: string;
    name: string;
    rule_count: number;
    avg_rule_score: number;
    total_good_feedback: number;
    total_bad_feedback: number;
  }>;
}

// GET /api/interpretation/dashboard - Get dashboard statistics
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

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section'); // 'overview', 'rules', 'evolution', 'activity', 'performance', or null for all

    const stats: Partial<DashboardStats> = {};

    // Overview section
    if (!section || section === 'overview') {
      stats.overview = await getOverviewStats(supabase);
    }

    // Rule statistics section
    if (!section || section === 'rules') {
      stats.rule_stats = await getRuleStats(supabase);
    }

    // Evolution statistics section
    if (!section || section === 'evolution') {
      stats.evolution_stats = await getEvolutionStats(supabase);
    }

    // Recent activity section
    if (!section || section === 'activity') {
      stats.recent_activity = await getRecentActivity(supabase);
    }

    // Document performance section
    if (!section || section === 'performance') {
      stats.document_performance = await getDocumentPerformance(supabase);
    }

    return NextResponse.json({
      success: true,
      data: stats,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get overview statistics
 */
async function getOverviewStats(supabase: any): Promise<DashboardStats['overview']> {
  // Get document count
  const { count: docCount } = await supabase
    .from('qaev_documents')
    .select('*', { count: 'exact', head: true });

  // Get rule counts
  const { count: totalRules } = await supabase
    .from('qa_interpretation_rules')
    .select('*', { count: 'exact', head: true });

  const { count: enabledRules } = await supabase
    .from('qa_interpretation_rules')
    .select('*', { count: 'exact', head: true })
    .eq('enabled', true);

  // Get evolution run count
  const { count: evolutionRuns } = await supabase
    .from('qaev_evolution_history')
    .select('*', { count: 'exact', head: true });

  // Get scheduled run count
  const { count: scheduledRuns } = await supabase
    .from('qa_scheduled_evolution_logs')
    .select('*', { count: 'exact', head: true })
    .catch(() => ({ count: 0 })); // Table might not exist

  return {
    total_documents: docCount || 0,
    total_rules: totalRules || 0,
    enabled_rules: enabledRules || 0,
    total_evolution_runs: evolutionRuns || 0,
    total_scheduled_runs: scheduledRuns || 0,
  };
}

/**
 * Get rule statistics
 */
async function getRuleStats(supabase: any): Promise<DashboardStats['rule_stats']> {
  const { data: rules } = await supabase
    .from('qa_interpretation_rules')
    .select('rule_type, generation, score, enabled');

  if (!rules || rules.length === 0) {
    return {
      by_type: {},
      by_generation: {},
      avg_score: 0,
    };
  }

  // Count by type
  const byType: Record<string, number> = {};
  for (const rule of rules) {
    byType[rule.rule_type] = (byType[rule.rule_type] || 0) + 1;
  }

  // Count by generation
  const byGeneration: Record<string, number> = {};
  for (const rule of rules) {
    const gen = `gen_${rule.generation}`;
    byGeneration[gen] = (byGeneration[gen] || 0) + 1;
  }

  // Average score (enabled rules only)
  const enabledRules = rules.filter((r: any) => r.enabled);
  const avgScore = enabledRules.length > 0
    ? enabledRules.reduce((sum: number, r: any) => sum + r.score, 0) / enabledRules.length
    : 0;

  return {
    by_type: byType,
    by_generation: byGeneration,
    avg_score: Math.round(avgScore * 100) / 100,
  };
}

/**
 * Get evolution statistics
 */
async function getEvolutionStats(supabase: any): Promise<DashboardStats['evolution_stats']> {
  const { data: evolutions } = await supabase
    .from('qaev_evolution_history')
    .select('mutation_type, win_rate');

  if (!evolutions || evolutions.length === 0) {
    return {
      total_mutations: 0,
      avg_win_rate: 0,
      mutation_types: {},
    };
  }

  // Count by mutation type
  const mutationTypes: Record<string, number> = {};
  for (const evo of evolutions) {
    mutationTypes[evo.mutation_type] = (mutationTypes[evo.mutation_type] || 0) + 1;
  }

  // Average win rate (where not null)
  const withWinRate = evolutions.filter((e: any) => e.win_rate !== null);
  const avgWinRate = withWinRate.length > 0
    ? withWinRate.reduce((sum: number, e: any) => sum + e.win_rate, 0) / withWinRate.length
    : 0;

  return {
    total_mutations: evolutions.length,
    avg_win_rate: Math.round(avgWinRate * 100) / 100,
    mutation_types: mutationTypes,
  };
}

/**
 * Get recent activity
 */
async function getRecentActivity(supabase: any): Promise<DashboardStats['recent_activity']> {
  // Recent rules
  const { data: recentRules } = await supabase
    .from('qa_interpretation_rules')
    .select('id, document_id, rule_type, score, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // Recent evolutions
  const { data: recentEvolutions } = await supabase
    .from('qaev_evolution_history')
    .select('id, document_id, mutation_type, win_rate, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get document names for recent rules
  const ruleDocIds = (recentRules || []).map((r: any) => r.document_id);
  const evoDocIds = (recentEvolutions || []).map((e: any) => e.document_id);
  const allDocIds = [...new Set([...ruleDocIds, ...evoDocIds])];

  const { data: docs } = await supabase
    .from('qaev_documents')
    .select('id, file_name')
    .in('id', allDocIds);

  const docMap = new Map((docs || []).map((d: any) => [d.id, d.file_name]));

  return {
    recent_rules: (recentRules || []).map((r: any) => ({
      ...r,
      document_name: docMap.get(r.document_id) || 'Unknown',
    })),
    recent_evolutions: (recentEvolutions || []).map((e: any) => ({
      ...e,
      document_name: docMap.get(e.document_id) || 'Unknown',
    })),
  };
}

/**
 * Get document performance statistics
 */
async function getDocumentPerformance(supabase: any): Promise<DashboardStats['document_performance']> {
  // Get documents
  const { data: documents } = await supabase
    .from('qaev_documents')
    .select('id, file_name, total_good_count, total_bad_count')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (!documents || documents.length === 0) {
    return [];
  }

  // Get rules for each document
  const docIds = documents.map((d: any) => d.id);
  const { data: rules } = await supabase
    .from('qa_interpretation_rules')
    .select('document_id, score, enabled')
    .in('document_id', docIds)
    .eq('enabled', true);

  // Group rules by document
  const rulesByDoc = new Map<string, any[]>();
  for (const rule of (rules || [])) {
    const existing = rulesByDoc.get(rule.document_id) || [];
    existing.push(rule);
    rulesByDoc.set(rule.document_id, existing);
  }

  return documents.map((doc: any) => {
    const docRules = rulesByDoc.get(doc.id) || [];
    const avgScore = docRules.length > 0
      ? docRules.reduce((sum: number, r: any) => sum + r.score, 0) / docRules.length
      : 0;

    return {
      id: doc.id,
      name: doc.file_name,
      rule_count: docRules.length,
      avg_rule_score: Math.round(avgScore * 100) / 100,
      total_good_feedback: doc.total_good_count || 0,
      total_bad_feedback: doc.total_bad_count || 0,
    };
  });
}
