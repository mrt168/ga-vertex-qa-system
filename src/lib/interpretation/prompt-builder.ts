/**
 * Prompt Builder with Interpretation Layer
 * 解釈ルールを含むプロンプトを構築
 */

import { InterpretationRule, RuleType } from './types';

interface RulesByType {
  CONTEXT: InterpretationRule[];
  CLARIFICATION: InterpretationRule[];
  FORMAT: InterpretationRule[];
  MISUNDERSTANDING: InterpretationRule[];
  RELATED: InterpretationRule[];
}

/**
 * ルールをタイプごとにグループ化
 */
function groupRulesByType(rules: InterpretationRule[]): RulesByType {
  const grouped: RulesByType = {
    CONTEXT: [],
    CLARIFICATION: [],
    FORMAT: [],
    MISUNDERSTANDING: [],
    RELATED: [],
  };

  for (const rule of rules) {
    grouped[rule.rule_type].push(rule);
  }

  return grouped;
}

/**
 * 解釈ガイドセクションを構築
 */
function buildInterpretationGuideSection(rules: InterpretationRule[]): string {
  if (rules.length === 0) {
    return '';
  }

  const grouped = groupRulesByType(rules);
  const sections: string[] = [];

  // CONTEXT: 補足情報・前提条件
  if (grouped.CONTEXT.length > 0) {
    sections.push(`### 補足情報・前提条件
${grouped.CONTEXT.map((r) => `- ${r.content}`).join('\n')}`);
  }

  // CLARIFICATION: 曖昧な表現の解釈
  if (grouped.CLARIFICATION.length > 0) {
    sections.push(`### 曖昧な表現の解釈
${grouped.CLARIFICATION.map((r) => `- ${r.content}`).join('\n')}`);
  }

  // MISUNDERSTANDING: よくある誤解
  if (grouped.MISUNDERSTANDING.length > 0) {
    sections.push(`### よくある誤解（注意）
${grouped.MISUNDERSTANDING.map((r) => `- ${r.content}`).join('\n')}`);
  }

  // FORMAT: 回答形式のガイド
  if (grouped.FORMAT.length > 0) {
    sections.push(`### 回答形式のガイド
${grouped.FORMAT.map((r) => `- ${r.content}`).join('\n')}`);
  }

  // RELATED: 関連情報
  if (grouped.RELATED.length > 0) {
    sections.push(`### 関連情報
${grouped.RELATED.map((r) => `- ${r.content}`).join('\n')}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `## 解釈ガイド（回答時に考慮してください）

${sections.join('\n\n')}`;
}

/**
 * 解釈ルールを含むRAGプロンプトを構築
 */
export function buildRAGPromptWithInterpretation(
  question: string,
  context: string,
  rules: InterpretationRule[]
): string {
  const interpretationGuide = buildInterpretationGuideSection(rules);

  const basePrompt = `あなたは社内QAアシスタントです。以下のドキュメントを参考に、ユーザーの質問に正確に回答してください。

## 参考ドキュメント
${context}`;

  const guidedPrompt = interpretationGuide
    ? `${basePrompt}

${interpretationGuide}`
    : basePrompt;

  return `${guidedPrompt}

## ユーザーの質問
${question}

## 回答ガイドライン
- 参考ドキュメントに基づいて回答してください
- 解釈ガイドがある場合は、それを考慮して回答してください
- 不明な点は「ドキュメントに記載がありません」と正直に回答してください
- 回答は簡潔かつ正確に
- 日本語で回答してください`;
}

/**
 * 基本のRAGプロンプト（ルールなし）- フォールバック用
 */
export function buildBasicRAGPrompt(question: string, context: string): string {
  return `あなたは社内QAアシスタントです。以下のドキュメントを参考に、ユーザーの質問に正確に回答してください。

## 参考ドキュメント
${context}

## ユーザーの質問
${question}

## 回答ガイドライン
- 参考ドキュメントに基づいて回答してください
- 不明な点は「ドキュメントに記載がありません」と正直に回答してください
- 回答は簡潔かつ正確に
- 日本語で回答してください`;
}

/**
 * 解釈ルール生成用プロンプト
 */
export function buildInterpretationRuleGenerationPrompt(
  documentContent: string,
  feedbacks: Array<{
    user_query: string;
    ai_response: string;
    feedback_text?: string;
  }>
): string {
  const feedbackList = feedbacks
    .map(
      (f, i) =>
        `${i + 1}. 質問: ${f.user_query}
   回答: ${f.ai_response.slice(0, 200)}...
   ユーザーの不満: ${f.feedback_text || '不明'}`
    )
    .join('\n\n');

  return `あなたは社内QAシステムの改善専門家です。

## タスク
以下のドキュメントとユーザーフィードバックを分析し、回答品質を向上させるための「解釈ルール」を提案してください。

## 重要
- ドキュメント自体は変更しません
- 回答生成時に適用する「補足情報」「解釈ガイド」を作成します
- 元のドキュメントの正確性を損なわないようにしてください

## ドキュメント内容
${documentContent}

## 低評価フィードバック
${feedbackList}

## 解釈ルールの種類
1. CONTEXT: 補足情報・前提条件（このドキュメントを理解するための背景知識）
2. CLARIFICATION: 曖昧な表現の解釈（「適宜」は「3営業日以内」など）
3. FORMAT: 回答形式のガイド（手順は箇条書きで、など）
4. MISUNDERSTANDING: よくある誤解（○○と△△は別物、など）
5. RELATED: 関連情報への参照（この手順の前に□□を確認、など）

## 出力形式（JSON配列）
以下のJSON配列形式で、3つの解釈ルールを提案してください。JSON以外の説明は不要です。

[
  {
    "rule_type": "CONTEXT" | "CLARIFICATION" | "FORMAT" | "MISUNDERSTANDING" | "RELATED",
    "content": "ルール内容（回答生成時に参照される自然言語の説明）",
    "trigger_pattern": "適用条件（キーワードや正規表現パターン、常に適用する場合はnull）",
    "rationale": "なぜこのルールが必要か（フィードバックとの関連）"
  }
]`;
}

/**
 * 解釈ルール評価用プロンプト（ペアワイズ比較）
 */
export function buildInterpretationEvaluationPrompt(
  question: string,
  responseWithoutRule: string,
  responseWithRule: string
): string {
  return `以下の2つの回答を比較し、どちらがユーザーの質問により適切に回答しているか評価してください。

## 質問
${question}

## 回答A（解釈ルールなし）
${responseWithoutRule}

## 回答B（解釈ルールあり）
${responseWithRule}

## 評価基準
1. 正確性（Correctness）: 情報が正確か（1-5点）
2. 有用性（Helpfulness）: 質問への回答として役立つか（1-5点）
3. 一貫性（Coherence）: わかりやすく一貫しているか（1-5点）

## 出力形式
以下のJSON形式で出力してください。JSON以外の説明は不要です。

{
  "winner": "A" | "B" | "TIE",
  "scores": {
    "A": {"correctness": 1-5, "helpfulness": 1-5, "coherence": 1-5},
    "B": {"correctness": 1-5, "helpfulness": 1-5, "coherence": 1-5}
  },
  "reasoning": "選択理由を日本語で記述"
}`;
}

export const PromptBuilder = {
  buildRAGPromptWithInterpretation,
  buildBasicRAGPrompt,
  buildInterpretationRuleGenerationPrompt,
  buildInterpretationEvaluationPrompt,
  groupRulesByType,
};
