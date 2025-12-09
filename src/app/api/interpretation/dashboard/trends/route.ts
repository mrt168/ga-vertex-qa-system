/**
 * Evolution Trends API
 * 時系列トレンドデータの取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface TrendData {
  daily_evolution_counts: Array<{
    date: string;
    self_evolution: number;
    feedback_evolution: number;
    total: number;
  }>;
  daily_rule_adoption: Array<{
    date: string;
    rules_adopted: number;
    avg_score: number;
  }>;
  rule_type_trend: Array<{
    date: string;
    CONTEXT: number;
    CLARIFICATION: number;
    FORMAT: number;
    MISUNDERSTANDING: number;
    RELATED: number;
  }>;
  feedback_trend: Array<{
    date: string;
    good_count: number;
    bad_count: number;
    ratio: number;
  }>;
}

// GET /api/interpretation/dashboard/trends - Get trend data for charts
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
    const days = parseInt(searchParams.get('days') || '30', 10);
    const trend = searchParams.get('trend'); // 'evolution', 'rules', 'types', 'feedback', or null for all

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends: Partial<TrendData> = {};

    // Daily evolution counts
    if (!trend || trend === 'evolution') {
      trends.daily_evolution_counts = await getDailyEvolutionCounts(supabase, startDate, endDate);
    }

    // Daily rule adoption
    if (!trend || trend === 'rules') {
      trends.daily_rule_adoption = await getDailyRuleAdoption(supabase, startDate, endDate);
    }

    // Rule type trend
    if (!trend || trend === 'types') {
      trends.rule_type_trend = await getRuleTypeTrend(supabase, startDate, endDate);
    }

    // Feedback trend
    if (!trend || trend === 'feedback') {
      trends.feedback_trend = await getFeedbackTrend(supabase, startDate, endDate);
    }

    return NextResponse.json({
      success: true,
      data: trends,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get daily evolution counts
 */
async function getDailyEvolutionCounts(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<TrendData['daily_evolution_counts']> {
  const { data: evolutions } = await supabase
    .from('qaev_evolution_history')
    .select('mutation_type, created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!evolutions || evolutions.length === 0) {
    return generateEmptyDailyData(startDate, endDate, (date) => ({
      date,
      self_evolution: 0,
      feedback_evolution: 0,
      total: 0,
    }));
  }

  // Group by date
  const byDate = new Map<string, { self: number; feedback: number }>();

  for (const evo of evolutions) {
    const date = new Date(evo.created_at).toISOString().split('T')[0];
    const current = byDate.get(date) || { self: 0, feedback: 0 };

    if (evo.mutation_type === 'SELF_EVOLUTION') {
      current.self++;
    } else {
      current.feedback++;
    }

    byDate.set(date, current);
  }

  return generateDailyData(startDate, endDate, (date) => {
    const data = byDate.get(date) || { self: 0, feedback: 0 };
    return {
      date,
      self_evolution: data.self,
      feedback_evolution: data.feedback,
      total: data.self + data.feedback,
    };
  });
}

/**
 * Get daily rule adoption counts
 */
async function getDailyRuleAdoption(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<TrendData['daily_rule_adoption']> {
  const { data: rules } = await supabase
    .from('qa_interpretation_rules')
    .select('score, created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!rules || rules.length === 0) {
    return generateEmptyDailyData(startDate, endDate, (date) => ({
      date,
      rules_adopted: 0,
      avg_score: 0,
    }));
  }

  // Group by date
  const byDate = new Map<string, { count: number; totalScore: number }>();

  for (const rule of rules) {
    const date = new Date(rule.created_at).toISOString().split('T')[0];
    const current = byDate.get(date) || { count: 0, totalScore: 0 };
    current.count++;
    current.totalScore += rule.score;
    byDate.set(date, current);
  }

  return generateDailyData(startDate, endDate, (date) => {
    const data = byDate.get(date);
    return {
      date,
      rules_adopted: data?.count || 0,
      avg_score: data ? Math.round((data.totalScore / data.count) * 100) / 100 : 0,
    };
  });
}

/**
 * Get rule type trend
 */
async function getRuleTypeTrend(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<TrendData['rule_type_trend']> {
  const { data: rules } = await supabase
    .from('qa_interpretation_rules')
    .select('rule_type, created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const ruleTypes = ['CONTEXT', 'CLARIFICATION', 'FORMAT', 'MISUNDERSTANDING', 'RELATED'] as const;

  if (!rules || rules.length === 0) {
    return generateEmptyDailyData(startDate, endDate, (date) => ({
      date,
      CONTEXT: 0,
      CLARIFICATION: 0,
      FORMAT: 0,
      MISUNDERSTANDING: 0,
      RELATED: 0,
    }));
  }

  // Group by date
  const byDate = new Map<string, Record<string, number>>();

  for (const rule of rules) {
    const date = new Date(rule.created_at).toISOString().split('T')[0];
    const current = byDate.get(date) || {};
    current[rule.rule_type] = (current[rule.rule_type] || 0) + 1;
    byDate.set(date, current);
  }

  return generateDailyData(startDate, endDate, (date) => {
    const data = byDate.get(date) || {};
    return {
      date,
      CONTEXT: data.CONTEXT || 0,
      CLARIFICATION: data.CLARIFICATION || 0,
      FORMAT: data.FORMAT || 0,
      MISUNDERSTANDING: data.MISUNDERSTANDING || 0,
      RELATED: data.RELATED || 0,
    };
  });
}

/**
 * Get feedback trend
 */
async function getFeedbackTrend(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<TrendData['feedback_trend']> {
  const { data: feedbacks } = await supabase
    .from('qaev_feedback_logs')
    .select('rating, created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!feedbacks || feedbacks.length === 0) {
    return generateEmptyDailyData(startDate, endDate, (date) => ({
      date,
      good_count: 0,
      bad_count: 0,
      ratio: 0,
    }));
  }

  // Group by date
  const byDate = new Map<string, { good: number; bad: number }>();

  for (const fb of feedbacks) {
    const date = new Date(fb.created_at).toISOString().split('T')[0];
    const current = byDate.get(date) || { good: 0, bad: 0 };

    if (fb.rating === 'GOOD') {
      current.good++;
    } else {
      current.bad++;
    }

    byDate.set(date, current);
  }

  return generateDailyData(startDate, endDate, (date) => {
    const data = byDate.get(date) || { good: 0, bad: 0 };
    const total = data.good + data.bad;
    return {
      date,
      good_count: data.good,
      bad_count: data.bad,
      ratio: total > 0 ? Math.round((data.good / total) * 100) / 100 : 0,
    };
  });
}

/**
 * Generate daily data with mapper function
 */
function generateDailyData<T>(
  startDate: Date,
  endDate: Date,
  mapper: (date: string) => T
): T[] {
  const result: T[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    result.push(mapper(dateStr));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Generate empty daily data (alias for consistency)
 */
function generateEmptyDailyData<T>(
  startDate: Date,
  endDate: Date,
  mapper: (date: string) => T
): T[] {
  return generateDailyData(startDate, endDate, mapper);
}
