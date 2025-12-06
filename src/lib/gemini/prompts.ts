import { Feedback, MutationType } from './types';

// RAG用プロンプト
export function buildRAGPrompt(question: string, context: string): string {
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

// 変異プロンプト（CLARITY）
export function buildMutationClarityPrompt(
  currentContent: string,
  feedbacks: Feedback[]
): string {
  const feedbackList = feedbacks
    .map((f, i) => `${i + 1}. 質問: ${f.user_query}\n   不満: ${f.feedback_text || 'わかりにくい'}`)
    .join('\n');

  return `以下のMarkdownドキュメントは、ユーザーから不評を受けました。
不満の内容を踏まえ、より明確でわかりやすい内容に書き換えてください。

## 現行ドキュメント
${currentContent}

## ユーザーからの不満
${feedbackList}

## 書き換え指示
- 専門用語を避け、初心者にもわかりやすく
- 具体例を追加
- 構成を論理的に整理

書き換えたMarkdownを出力してください。メタデータや説明は不要です。Markdownのみを出力してください。`;
}

// 変異プロンプト（DETAIL）
export function buildMutationDetailPrompt(currentContent: string, feedbacks: Feedback[]): string {
  const feedbackList = feedbacks
    .map((f, i) => `${i + 1}. 質問: ${f.user_query}\n   不満: ${f.feedback_text || '情報不足'}`)
    .join('\n');

  return `以下のMarkdownドキュメントは情報不足で不評を受けました。
不足している情報を補足し、より詳細な内容に拡充してください。

## 現行ドキュメント
${currentContent}

## 不足している情報（ユーザーフィードバック）
${feedbackList}

## 拡充指示
- 不足情報を追加
- 手順を詳細に記載
- 関連情報へのリンクを追加

拡充したMarkdownを出力してください。メタデータや説明は不要です。Markdownのみを出力してください。`;
}

// 変異プロンプト（STRUCTURE）
export function buildMutationStructurePrompt(
  currentContent: string,
  feedbacks: Feedback[]
): string {
  const feedbackList = feedbacks
    .map((f, i) => `${i + 1}. 質問: ${f.user_query}\n   不満: ${f.feedback_text || '見づらい'}`)
    .join('\n');

  return `以下のMarkdownドキュメントは構成が悪く不評を受けました。
より読みやすく、わかりやすい構成に改善してください。

## 現行ドキュメント
${currentContent}

## ユーザーからの不満
${feedbackList}

## 改善指示
- 見出し構造を改善
- 箇条書きや表を活用
- 重要情報を目立たせる

改善したMarkdownを出力してください。メタデータや説明は不要です。Markdownのみを出力してください。`;
}

// 変異プロンプト（QA_FOCUS）
export function buildMutationQAFocusPrompt(
  currentContent: string,
  feedbacks: Feedback[]
): string {
  const feedbackList = feedbacks
    .map((f, i) => `${i + 1}. 質問: ${f.user_query}\n   不満: ${f.feedback_text || '回答しにくい'}`)
    .join('\n');

  return `以下のMarkdownドキュメントをFAQ形式に変換し、質問に答えやすい構成にしてください。

## 現行ドキュメント
${currentContent}

## ユーザーからの質問と不満
${feedbackList}

## 変換指示
- FAQ形式（Q&A）に変換
- よくある質問を明示
- 回答をわかりやすく記載

FAQ形式のMarkdownを出力してください。メタデータや説明は不要です。Markdownのみを出力してください。`;
}

// 変異プロンプト（統合）
export function buildMutationPrompt(
  currentContent: string,
  feedbacks: Feedback[],
  mutationType: MutationType
): string {
  switch (mutationType) {
    case 'CLARITY':
      return buildMutationClarityPrompt(currentContent, feedbacks);
    case 'DETAIL':
      return buildMutationDetailPrompt(currentContent, feedbacks);
    case 'STRUCTURE':
      return buildMutationStructurePrompt(currentContent, feedbacks);
    case 'QA_FOCUS':
      return buildMutationQAFocusPrompt(currentContent, feedbacks);
  }
}

// 評価プロンプト（ペアワイズ比較）
export function buildEvaluationPrompt(question: string, docA: string, docB: string): string {
  return `以下の2つのドキュメントを比較し、ユーザーの質問に対してどちらがより適切に回答できるか評価してください。

## 質問
${question}

## ドキュメントA（現行版）
${docA}

## ドキュメントB（修正案）
${docB}

## 評価基準
1. 正確性（Correctness）: 情報が正確か（1-5点）
2. 有用性（Helpfulness）: 質問への回答として役立つか（1-5点）
3. 明確性（Clarity）: わかりやすいか（1-5点）

## 出力形式
以下のJSON形式で出力してください。JSON以外の説明は不要です。

{
  "winner": "A" または "B",
  "scores": {
    "A": {"correctness": 1-5, "helpfulness": 1-5, "clarity": 1-5},
    "B": {"correctness": 1-5, "helpfulness": 1-5, "clarity": 1-5}
  },
  "reasoning": "選択理由を日本語で記述"
}`;
}
