/**
 * Synthetic Question Generator
 * ドキュメントから自動的に質問を生成
 */

import { VertexGeminiClient } from '@/lib/gemini/vertex-client';
import {
  SyntheticQuestion,
  QuestionCategory,
  QuestionDifficulty,
  SelfEvolutionConfig,
  DEFAULT_SELF_EVOLUTION_CONFIG,
} from './types';

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

export class SyntheticQuestionGenerator {
  constructor(private geminiClient: VertexGeminiClient) {}

  /**
   * ドキュメントから質問を自動生成
   */
  async generateQuestions(
    document: DocumentContent,
    config: Partial<SelfEvolutionConfig> = {}
  ): Promise<SyntheticQuestion[]> {
    const fullConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...config };
    const allQuestions: SyntheticQuestion[] = [];

    // 各カテゴリごとに質問を生成
    for (const category of fullConfig.includeCategories) {
      const questions = await this.generateQuestionsForCategory(
        document,
        category,
        fullConfig.questionsPerCategory,
        fullConfig.difficultyDistribution
      );
      allQuestions.push(...questions);
    }

    return allQuestions;
  }

  /**
   * 特定カテゴリの質問を生成
   */
  private async generateQuestionsForCategory(
    document: DocumentContent,
    category: QuestionCategory,
    count: number,
    difficultyDist: Record<QuestionDifficulty, number>
  ): Promise<SyntheticQuestion[]> {
    const prompt = this.buildQuestionGenerationPrompt(
      document,
      category,
      count,
      difficultyDist
    );

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.8, // 多様な質問を生成するため高めに
        maxOutputTokens: 2048,
      });

      return this.parseQuestionResponse(response, category);
    } catch (error) {
      console.error(`Failed to generate ${category} questions:`, error);
      return [];
    }
  }

  /**
   * 質問生成プロンプトを構築
   */
  private buildQuestionGenerationPrompt(
    document: DocumentContent,
    category: QuestionCategory,
    count: number,
    difficultyDist: Record<QuestionDifficulty, number>
  ): string {
    const categoryDescriptions: Record<QuestionCategory, string> = {
      factual: '事実確認の質問（「〜はどこに記載されていますか？」「〜の値は？」など）',
      procedural: '手順・プロセスに関する質問（「〜の手順を教えてください」「〜するにはどうすればいい？」）',
      clarification: '曖昧な点の確認（「〜とは具体的に何ですか？」「〜の条件は？」）',
      comparison: '比較の質問（「AとBの違いは？」「〜と〜はどちらが適切？」）',
      edge_case: 'エッジケース・例外の質問（「〜の場合はどうなりますか？」「例外的なケースは？」）',
      implicit: '暗黙の前提知識が必要な質問（ドキュメントに直接書かれていないが推測が必要）',
    };

    const difficultyDescriptions: Record<QuestionDifficulty, string> = {
      easy: '簡単：ドキュメントに直接書かれている内容',
      medium: '中程度：複数の情報を組み合わせる必要がある',
      hard: '難しい：深い理解や推論が必要',
      edge_case: 'エッジケース：境界条件や例外的状況',
    };

    // 難易度分布に基づいて各難易度の質問数を決定
    const difficultyBreakdown = Object.entries(difficultyDist)
      .map(([diff, ratio]) => `${difficultyDescriptions[diff as QuestionDifficulty]}: ${Math.round(count * ratio)}問`)
      .join('\n');

    return `あなたは社内QAシステムのテスト担当者です。
以下のドキュメントを分析し、「${categoryDescriptions[category]}」タイプの質問を${count}個生成してください。

## ドキュメント名
${document.name}

## ドキュメント内容
${document.content.slice(0, 8000)}

## 質問カテゴリ
${categoryDescriptions[category]}

## 難易度分布
${difficultyBreakdown}

## 重要な指示
1. 実際のユーザーが聞きそうな自然な質問にする
2. ドキュメントの重要な部分をカバーする
3. 曖昧な表現や誤解しやすい部分を特に狙う
4. 質問ごとに、回答に含まれるべきトピックを明記する

## 出力形式（JSON配列）
以下のJSON形式で出力してください。JSON以外の説明は不要です。

[
  {
    "question": "質問文",
    "difficulty": "easy|medium|hard|edge_case",
    "expected_topics": ["回答に含まれるべきトピック1", "トピック2"],
    "rationale": "この質問が重要な理由"
  }
]`;
  }

  /**
   * レスポンスをパース
   */
  private parseQuestionResponse(
    response: string,
    category: QuestionCategory
  ): SyntheticQuestion[] {
    try {
      let jsonStr = response;

      // Remove markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Find JSON array
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        console.warn('Response is not an array:', parsed);
        return [];
      }

      const questions: SyntheticQuestion[] = [];

      for (const item of parsed) {
        if (this.isValidQuestion(item)) {
          questions.push({
            question: item.question,
            category,
            difficulty: this.normalizeDifficulty(item.difficulty),
            expected_topics: item.expected_topics || [],
            rationale: item.rationale || '',
          });
        }
      }

      return questions;
    } catch (error) {
      console.error('Failed to parse question response:', error);
      console.error('Response was:', response);
      return [];
    }
  }

  /**
   * 質問が有効かどうかを検証
   */
  private isValidQuestion(item: unknown): boolean {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const q = item as Record<string, unknown>;

    if (typeof q.question !== 'string' || q.question.trim() === '') {
      return false;
    }

    return true;
  }

  /**
   * 難易度を正規化
   */
  private normalizeDifficulty(difficulty: unknown): QuestionDifficulty {
    const validDifficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard', 'edge_case'];

    if (typeof difficulty === 'string' && validDifficulties.includes(difficulty as QuestionDifficulty)) {
      return difficulty as QuestionDifficulty;
    }

    return 'medium';
  }

  /**
   * ドキュメントの弱点を狙った質問を追加生成
   */
  async generateTargetedQuestions(
    document: DocumentContent,
    weaknessType: string,
    count: number = 3
  ): Promise<SyntheticQuestion[]> {
    const prompt = `あなたは社内QAシステムのテスト担当者です。
以下のドキュメントの弱点を突く質問を${count}個生成してください。

## ドキュメント名
${document.name}

## ドキュメント内容
${document.content.slice(0, 6000)}

## 弱点タイプ
${weaknessType}

## 目的
この弱点を持つドキュメントに対して、AIが間違いやすい質問を生成する。
生成された質問に対する回答を改善するためのルールを作成するのに使用する。

## 出力形式（JSON配列）
[
  {
    "question": "質問文",
    "difficulty": "hard",
    "expected_topics": ["期待されるトピック"],
    "rationale": "この質問が弱点を突く理由"
  }
]`;

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.7,
        maxOutputTokens: 1024,
      });

      return this.parseQuestionResponse(response, 'edge_case');
    } catch (error) {
      console.error('Failed to generate targeted questions:', error);
      return [];
    }
  }
}
