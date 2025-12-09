/**
 * Interpretation Service
 * 解釈ルールの取得・管理・適用を担当
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  InterpretationRule,
  InterpretationApplication,
  InterpretationStats,
  RuleType,
  InsertInterpretationRule,
} from './types';

// Score adjustment constants
const SCORE_INCREASE_ON_GOOD = 0.05;
const SCORE_DECREASE_ON_BAD = 0.1;
const MIN_SCORE = 0.0;
const MAX_SCORE = 1.0;

export class InterpretationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 該当ドキュメント・クエリに適用可能なルールを取得
   * - 有効なルール (enabled: true) のみ
   * - trigger_pattern がある場合はクエリとマッチするもののみ
   * - スコア順にソート
   */
  async getApplicableRules(
    documentId: string,
    query: string
  ): Promise<InterpretationRule[]> {
    try {
      // Get all enabled rules for the document
      const { data: rules, error } = await this.supabase
        .from('qa_interpretation_rules')
        .select('*')
        .eq('document_id', documentId)
        .eq('enabled', true)
        .order('score', { ascending: false });

      if (error) {
        console.error('Error fetching interpretation rules:', error);
        return [];
      }

      if (!rules || rules.length === 0) {
        return [];
      }

      // Filter by trigger_pattern if present
      const applicableRules = rules.filter((rule) => {
        if (!rule.trigger_pattern) {
          // No trigger pattern = always apply
          return true;
        }
        try {
          // Check if query matches the trigger pattern (case-insensitive)
          const pattern = new RegExp(rule.trigger_pattern, 'i');
          return pattern.test(query);
        } catch {
          // If pattern is invalid, treat as keyword match
          return query.toLowerCase().includes(rule.trigger_pattern.toLowerCase());
        }
      });

      return applicableRules as InterpretationRule[];
    } catch (error) {
      console.error('Error in getApplicableRules:', error);
      return [];
    }
  }

  /**
   * ルール適用履歴を記録
   */
  async recordApplication(
    messageId: string,
    documentId: string,
    ruleIds: string[]
  ): Promise<string | null> {
    try {
      const applicationId = uuidv4();
      const { error } = await this.supabase
        .from('qa_interpretation_applications')
        .insert({
          id: applicationId,
          message_id: messageId,
          document_id: documentId,
          applied_rule_ids: ruleIds,
        });

      if (error) {
        console.error('Error recording interpretation application:', error);
        return null;
      }

      return applicationId;
    } catch (error) {
      console.error('Error in recordApplication:', error);
      return null;
    }
  }

  /**
   * フィードバック後にルールスコアを更新
   * GOOD: スコア上昇, BAD: スコア下降
   */
  async updateRuleScores(
    messageId: string,
    rating: 'GOOD' | 'BAD'
  ): Promise<void> {
    try {
      // Get the application record
      const { data: application, error: fetchError } = await this.supabase
        .from('qa_interpretation_applications')
        .select('*')
        .eq('message_id', messageId)
        .single();

      if (fetchError || !application) {
        // No application record for this message (no rules were applied)
        return;
      }

      // Update the application with feedback rating
      await this.supabase
        .from('qa_interpretation_applications')
        .update({ feedback_rating: rating })
        .eq('id', application.id);

      // Update scores for each applied rule
      const ruleIds = application.applied_rule_ids as string[];
      if (!ruleIds || ruleIds.length === 0) {
        return;
      }

      for (const ruleId of ruleIds) {
        const { data: rule, error: ruleError } = await this.supabase
          .from('qa_interpretation_rules')
          .select('score')
          .eq('id', ruleId)
          .single();

        if (ruleError || !rule) {
          continue;
        }

        const currentScore = rule.score;
        let newScore: number;

        if (rating === 'GOOD') {
          newScore = Math.min(currentScore + SCORE_INCREASE_ON_GOOD, MAX_SCORE);
        } else {
          newScore = Math.max(currentScore - SCORE_DECREASE_ON_BAD, MIN_SCORE);
        }

        await this.supabase
          .from('qa_interpretation_rules')
          .update({ score: newScore, updated_at: new Date().toISOString() })
          .eq('id', ruleId);
      }
    } catch (error) {
      console.error('Error in updateRuleScores:', error);
    }
  }

  /**
   * ルールの有効/無効を切り替え
   */
  async setRuleEnabled(ruleId: string, enabled: boolean): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('qa_interpretation_rules')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', ruleId);

      if (error) {
        console.error('Error setting rule enabled:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in setRuleEnabled:', error);
      return false;
    }
  }

  /**
   * ルール一覧を取得
   */
  async listRules(documentId?: string): Promise<InterpretationRule[]> {
    try {
      let query = this.supabase
        .from('qa_interpretation_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (documentId) {
        query = query.eq('document_id', documentId);
      }

      const { data: rules, error } = await query;

      if (error) {
        console.error('Error listing rules:', error);
        return [];
      }

      return (rules || []) as InterpretationRule[];
    } catch (error) {
      console.error('Error in listRules:', error);
      return [];
    }
  }

  /**
   * ルールを作成（進化エンジン用）
   */
  async createRule(rule: InsertInterpretationRule): Promise<InterpretationRule | null> {
    try {
      const ruleId = rule.id || uuidv4();
      const now = new Date().toISOString();

      const insertData = {
        id: ruleId,
        document_id: rule.document_id,
        rule_type: rule.rule_type,
        content: rule.content,
        trigger_pattern: rule.trigger_pattern || null,
        generation: rule.generation || 1,
        score: rule.score || 0.5,
        enabled: rule.enabled !== undefined ? rule.enabled : true,
        source_feedback_ids: rule.source_feedback_ids || [],
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await this.supabase
        .from('qa_interpretation_rules')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating rule:', error);
        return null;
      }

      return data as InterpretationRule;
    } catch (error) {
      console.error('Error in createRule:', error);
      return null;
    }
  }

  /**
   * ルールを削除
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('qa_interpretation_rules')
        .delete()
        .eq('id', ruleId);

      if (error) {
        console.error('Error deleting rule:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteRule:', error);
      return false;
    }
  }

  /**
   * ルールを取得（単一）
   */
  async getRule(ruleId: string): Promise<InterpretationRule | null> {
    try {
      const { data, error } = await this.supabase
        .from('qa_interpretation_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (error) {
        console.error('Error getting rule:', error);
        return null;
      }

      return data as InterpretationRule;
    } catch (error) {
      console.error('Error in getRule:', error);
      return null;
    }
  }

  /**
   * 統計情報を取得
   */
  async getStats(): Promise<InterpretationStats> {
    try {
      // Get all rules
      const { data: rules, error: rulesError } = await this.supabase
        .from('qa_interpretation_rules')
        .select('*');

      if (rulesError) {
        throw rulesError;
      }

      // Get all applications with feedback
      const { data: applications, error: appsError } = await this.supabase
        .from('qa_interpretation_applications')
        .select('*');

      if (appsError) {
        throw appsError;
      }

      const rulesList = (rules || []) as InterpretationRule[];
      const appsList = (applications || []) as InterpretationApplication[];

      // Calculate stats
      const totalRules = rulesList.length;
      const enabledRules = rulesList.filter((r) => r.enabled).length;

      const rulesByType: Record<RuleType, number> = {
        CONTEXT: 0,
        CLARIFICATION: 0,
        FORMAT: 0,
        MISUNDERSTANDING: 0,
        RELATED: 0,
      };

      let totalScore = 0;
      for (const rule of rulesList) {
        rulesByType[rule.rule_type]++;
        totalScore += rule.score;
      }

      const avgScore = totalRules > 0 ? totalScore / totalRules : 0;

      const totalApplications = appsList.length;
      const appsWithFeedback = appsList.filter((a) => a.feedback_rating);
      const positiveApps = appsWithFeedback.filter((a) => a.feedback_rating === 'GOOD');
      const positiveFeedbackRate =
        appsWithFeedback.length > 0
          ? positiveApps.length / appsWithFeedback.length
          : 0;

      return {
        total_rules: totalRules,
        enabled_rules: enabledRules,
        rules_by_type: rulesByType,
        avg_score: avgScore,
        total_applications: totalApplications,
        positive_feedback_rate: positiveFeedbackRate,
      };
    } catch (error) {
      console.error('Error in getStats:', error);
      return {
        total_rules: 0,
        enabled_rules: 0,
        rules_by_type: {
          CONTEXT: 0,
          CLARIFICATION: 0,
          FORMAT: 0,
          MISUNDERSTANDING: 0,
          RELATED: 0,
        },
        avg_score: 0,
        total_applications: 0,
        positive_feedback_rate: 0,
      };
    }
  }

  /**
   * ドキュメントの現在の世代番号を取得
   */
  async getCurrentGeneration(documentId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('qa_interpretation_rules')
        .select('generation')
        .eq('document_id', documentId)
        .order('generation', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return 0;
      }

      return data.generation;
    } catch {
      return 0;
    }
  }
}
