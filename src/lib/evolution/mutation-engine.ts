/**
 * Mutation Engine
 * Geminiを使用してドキュメントの変異（修正案）を生成
 */

import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import { DocumentCandidate, FeedbackContext, MutationType } from './types';
import { v4 as uuidv4 } from 'uuid';

interface MutationPrompt {
  type: MutationType;
  systemPrompt: string;
  userPromptTemplate: string;
}

const MUTATION_PROMPTS: MutationPrompt[] = [
  {
    type: 'MUTATION_CLARITY',
    systemPrompt: `あなたは社内ドキュメント改善の専門家です。
ユーザーからのフィードバックに基づいて、ドキュメントをより明確で分かりやすく書き換えてください。

書き換えのルール:
- 専門用語には説明を追加する
- 曖昧な表現を具体的にする
- 箇条書きや見出しを活用して読みやすくする
- 情報の順序を論理的に整理する`,
    userPromptTemplate: `以下のドキュメントを改善してください。

## 現在のドキュメント
{currentContent}

## ユーザーからの質問
{userQuery}

## AIの回答に対するフィードバック
{feedback}

## 指示
上記のフィードバックを考慮し、ユーザーの質問により適切に答えられるよう、ドキュメントを書き換えてください。
Markdown形式で出力してください。`,
  },
  {
    type: 'MUTATION_DETAIL',
    systemPrompt: `あなたは社内ドキュメント改善の専門家です。
ユーザーからのフィードバックに基づいて、ドキュメントに不足している詳細情報を追加してください。

追加のルール:
- 具体的な手順やステップを追加する
- 数値や期限などの具体的な情報を含める
- よくある質問（FAQ）形式の補足を追加する
- 関連する注意事項や例外ケースを記載する`,
    userPromptTemplate: `以下のドキュメントに詳細情報を追加してください。

## 現在のドキュメント
{currentContent}

## ユーザーからの質問
{userQuery}

## AIの回答に対するフィードバック
{feedback}

## 指示
上記のフィードバックから、不足している情報を特定し、ドキュメントに追加してください。
Markdown形式で出力してください。`,
  },
  {
    type: 'MUTATION_QA_FORMAT',
    systemPrompt: `あなたは社内ドキュメント改善の専門家です。
ユーザーからのフィードバックに基づいて、ドキュメントをQ&A形式に変換・追加してください。

変換のルール:
- よくある質問と回答のセクションを追加する
- 実際のユーザーの質問パターンを反映する
- 回答は簡潔かつ具体的にする
- 関連する質問へのリンクを示唆する`,
    userPromptTemplate: `以下のドキュメントにQ&Aセクションを追加してください。

## 現在のドキュメント
{currentContent}

## ユーザーからの質問
{userQuery}

## AIの回答に対するフィードバック
{feedback}

## 指示
上記の質問とフィードバックを参考に、同様の質問に対応できるQ&Aセクションを追加してください。
Markdown形式で出力してください。`,
  },
];

export class MutationEngine {
  private gemini = getVertexGeminiClient();

  /**
   * ドキュメントの変異（修正案）を生成
   */
  async generateMutations(
    documentId: string,
    currentContent: string,
    feedbackContexts: FeedbackContext[]
  ): Promise<DocumentCandidate[]> {
    const candidates: DocumentCandidate[] = [];

    // フィードバックを集約
    const aggregatedFeedback = this.aggregateFeedback(feedbackContexts);

    // 各変異タイプで候補を生成
    for (const mutationPrompt of MUTATION_PROMPTS) {
      try {
        const candidate = await this.generateSingleMutation(
          documentId,
          currentContent,
          aggregatedFeedback,
          mutationPrompt
        );
        candidates.push(candidate);
      } catch (error) {
        console.error(`Mutation generation failed for ${mutationPrompt.type}:`, error);
      }
    }

    return candidates;
  }

  /**
   * 単一の変異を生成
   */
  private async generateSingleMutation(
    documentId: string,
    currentContent: string,
    feedback: { queries: string[]; feedbacks: string[] },
    prompt: MutationPrompt
  ): Promise<DocumentCandidate> {
    const userPrompt = prompt.userPromptTemplate
      .replace('{currentContent}', currentContent)
      .replace('{userQuery}', feedback.queries.join('\n- '))
      .replace('{feedback}', feedback.feedbacks.join('\n- '));

    const fullPrompt = `${prompt.systemPrompt}\n\n${userPrompt}`;

    const content = await this.gemini.generateContent({
      prompt: fullPrompt,
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    return {
      id: uuidv4(),
      content: this.cleanMarkdownOutput(content),
      mutationType: prompt.type,
      sourceDocumentId: documentId,
    };
  }

  /**
   * フィードバックを集約
   */
  private aggregateFeedback(feedbackContexts: FeedbackContext[]): {
    queries: string[];
    feedbacks: string[];
  } {
    const queries: string[] = [];
    const feedbacks: string[] = [];

    for (const ctx of feedbackContexts) {
      queries.push(ctx.userQuery);
      if (ctx.feedbackText) {
        feedbacks.push(ctx.feedbackText);
      } else {
        feedbacks.push(`「${ctx.userQuery}」に対する回答が不十分でした`);
      }
    }

    return { queries, feedbacks };
  }

  /**
   * Markdownの出力をクリーンアップ
   */
  private cleanMarkdownOutput(content: string): string {
    // コードブロックのマーカーを除去
    let cleaned = content.trim();
    if (cleaned.startsWith('```markdown')) {
      cleaned = cleaned.slice(11);
    } else if (cleaned.startsWith('```md')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
  }
}

// Singleton instance
let mutationEngine: MutationEngine | null = null;

export function getMutationEngine(): MutationEngine {
  if (!mutationEngine) {
    mutationEngine = new MutationEngine();
  }
  return mutationEngine;
}
