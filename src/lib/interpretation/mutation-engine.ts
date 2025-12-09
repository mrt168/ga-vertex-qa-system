/**
 * Interpretation Mutation Engine
 * 低評価フィードバックを分析し、解釈ルール候補を生成
 */

import { VertexGeminiClient } from '@/lib/gemini/vertex-client';
import {
  InterpretationCandidate,
  RuleType,
} from './types';
import { buildInterpretationRuleGenerationPrompt } from './prompt-builder';

interface FeedbackForMutation {
  user_query: string;
  ai_response: string;
  feedback_text?: string;
}

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

export class InterpretationMutationEngine {
  constructor(private geminiClient: VertexGeminiClient) {}

  /**
   * 低評価フィードバックを分析し、解釈ルール候補を生成
   */
  async generateRuleCandidates(
    document: DocumentContent,
    feedbacks: FeedbackForMutation[]
  ): Promise<InterpretationCandidate[]> {
    if (feedbacks.length === 0) {
      return [];
    }

    const prompt = buildInterpretationRuleGenerationPrompt(
      document.content,
      feedbacks
    );

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
      });

      // Parse JSON response
      const candidates = this.parseResponse(response);
      return candidates;
    } catch (error) {
      console.error('Failed to generate interpretation rule candidates:', error);
      return [];
    }
  }

  /**
   * レスポンスをパースして候補を抽出
   */
  private parseResponse(response: string): InterpretationCandidate[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;

      // Remove markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Try to find JSON array
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        console.warn('Response is not an array:', parsed);
        return [];
      }

      // Validate and transform each candidate
      const candidates: InterpretationCandidate[] = [];

      for (const item of parsed) {
        if (this.isValidCandidate(item)) {
          candidates.push({
            rule_type: item.rule_type as RuleType,
            content: item.content,
            trigger_pattern: item.trigger_pattern || undefined,
            rationale: item.rationale || '',
          });
        }
      }

      return candidates;
    } catch (error) {
      console.error('Failed to parse rule generation response:', error);
      console.error('Response was:', response);
      return [];
    }
  }

  /**
   * 候補が有効かどうかを検証
   */
  private isValidCandidate(item: unknown): boolean {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const candidate = item as Record<string, unknown>;

    // Required fields
    if (typeof candidate.rule_type !== 'string') {
      return false;
    }
    if (typeof candidate.content !== 'string' || candidate.content.trim() === '') {
      return false;
    }

    // Validate rule_type
    const validTypes: RuleType[] = [
      'CONTEXT',
      'CLARIFICATION',
      'FORMAT',
      'MISUNDERSTANDING',
      'RELATED',
    ];
    if (!validTypes.includes(candidate.rule_type as RuleType)) {
      return false;
    }

    return true;
  }

  /**
   * 特定のルールタイプに対する候補を生成
   */
  async generateSpecificTypeCandidate(
    document: DocumentContent,
    feedbacks: FeedbackForMutation[],
    ruleType: RuleType
  ): Promise<InterpretationCandidate | null> {
    const typeDescriptions: Record<RuleType, string> = {
      CONTEXT: '補足情報・前提条件（このドキュメントを理解するための背景知識）',
      CLARIFICATION: '曖昧な表現の解釈（「適宜」→「3営業日以内」など具体化）',
      FORMAT: '回答形式のガイド（手順は箇条書きで、結論から先に、など）',
      MISUNDERSTANDING: 'よくある誤解（○○と△△は別物、混同しやすい点の注意）',
      RELATED: '関連情報への参照（この手順の前に□□を確認する必要がある、など）',
    };

    const feedbackList = feedbacks
      .map(
        (f, i) =>
          `${i + 1}. 質問: ${f.user_query}
   回答: ${f.ai_response.slice(0, 200)}...
   ユーザーの不満: ${f.feedback_text || '不明'}`
      )
      .join('\n\n');

    const prompt = `あなたは社内QAシステムの改善専門家です。

## タスク
以下のドキュメントとフィードバックを分析し、「${ruleType}」タイプの解釈ルールを1つ提案してください。

## ${ruleType}の説明
${typeDescriptions[ruleType]}

## 重要
- ドキュメント自体は変更しません
- 回答生成時に適用する「補足情報」を作成します

## ドキュメント内容
${document.content.slice(0, 3000)}

## 低評価フィードバック
${feedbackList}

## 出力形式（JSON）
以下のJSON形式で1つのルールを提案してください。JSON以外の説明は不要です。

{
  "rule_type": "${ruleType}",
  "content": "ルール内容",
  "trigger_pattern": "適用条件（キーワード、nullなら常に適用）",
  "rationale": "なぜこのルールが必要か"
}`;

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.7,
        maxOutputTokens: 1024,
      });

      // Parse single object response
      let jsonStr = response;

      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      if (this.isValidCandidate(parsed)) {
        return {
          rule_type: parsed.rule_type as RuleType,
          content: parsed.content,
          trigger_pattern: parsed.trigger_pattern || undefined,
          rationale: parsed.rationale || '',
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to generate ${ruleType} candidate:`, error);
      return null;
    }
  }
}
