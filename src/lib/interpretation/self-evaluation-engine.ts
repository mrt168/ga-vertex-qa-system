/**
 * Self-Evaluation Engine
 * AI同士で回答品質を評価し、弱点を特定
 */

import { VertexGeminiClient } from '@/lib/gemini/vertex-client';
import {
  SyntheticQuestion,
  SelfEvaluationResult,
  DocumentWeakness,
  InterpretationRule,
  RuleType,
  SelfEvolutionConfig,
  DEFAULT_SELF_EVOLUTION_CONFIG,
} from './types';
import {
  buildBasicRAGPrompt,
  buildRAGPromptWithInterpretation,
} from './prompt-builder';

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

interface EvaluationScores {
  accuracy: number;
  completeness: number;
  clarity: number;
  relevance: number;
}

export class SelfEvaluationEngine {
  constructor(private geminiClient: VertexGeminiClient) {}

  /**
   * 質問に対する回答を評価（ルールあり/なしの比較）
   */
  async evaluateWithComparison(
    document: DocumentContent,
    questions: SyntheticQuestion[],
    rules: InterpretationRule[],
    config: Partial<SelfEvolutionConfig> = {}
  ): Promise<SelfEvaluationResult[]> {
    const fullConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...config };
    const results: SelfEvaluationResult[] = [];

    for (const question of questions) {
      // 複数回評価して信頼性を上げる
      const iterationResults: SelfEvaluationResult[] = [];

      for (let i = 0; i < fullConfig.evaluationIterations; i++) {
        const result = await this.evaluateSingleQuestion(
          document,
          question,
          rules
        );
        if (result) {
          iterationResults.push(result);
        }
      }

      // 複数回の結果を集約
      if (iterationResults.length > 0) {
        const aggregated = this.aggregateResults(iterationResults);
        results.push(aggregated);
      }
    }

    return results;
  }

  /**
   * 単一の質問を評価
   */
  private async evaluateSingleQuestion(
    document: DocumentContent,
    question: SyntheticQuestion,
    rules: InterpretationRule[]
  ): Promise<SelfEvaluationResult | null> {
    try {
      // ルールなしで回答生成
      const promptWithoutRule = buildBasicRAGPrompt(question.question, document.content);
      const responseWithoutRule = await this.geminiClient.generateContent({
        prompt: promptWithoutRule,
        temperature: 0.5,
        maxOutputTokens: 1024,
      });

      // ルールありで回答生成
      const promptWithRule = buildRAGPromptWithInterpretation(
        question.question,
        document.content,
        rules
      );
      const responseWithRule = await this.geminiClient.generateContent({
        prompt: promptWithRule,
        temperature: 0.5,
        maxOutputTokens: 1024,
      });

      // 評価を実行
      const evaluation = await this.runEvaluation(
        question,
        responseWithoutRule,
        responseWithRule,
        document.content
      );

      if (!evaluation) {
        return null;
      }

      return {
        question,
        response_without_rule: responseWithoutRule,
        response_with_rule: responseWithRule,
        evaluation,
      };
    } catch (error) {
      console.error(`Evaluation failed for question: ${question.question}`, error);
      return null;
    }
  }

  /**
   * 評価を実行（LLM-as-Judge）
   */
  private async runEvaluation(
    question: SyntheticQuestion,
    responseA: string,
    responseB: string,
    documentContent: string
  ): Promise<SelfEvaluationResult['evaluation'] | null> {
    const prompt = this.buildEvaluationPrompt(
      question,
      responseA,
      responseB,
      documentContent
    );

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.2, // 評価は一貫性を重視
        maxOutputTokens: 1024,
      });

      return this.parseEvaluationResponse(response);
    } catch (error) {
      console.error('Evaluation failed:', error);
      return null;
    }
  }

  /**
   * 評価プロンプトを構築
   */
  private buildEvaluationPrompt(
    question: SyntheticQuestion,
    responseA: string,
    responseB: string,
    documentContent: string
  ): string {
    return `あなたは社内QAシステムの品質評価者です。
同じ質問に対する2つの回答を比較評価してください。

## 質問
${question.question}

## 期待されるトピック
${question.expected_topics.join(', ')}

## ドキュメント（参照元）
${documentContent.slice(0, 4000)}

## 回答A（ルールなし）
${responseA}

## 回答B（ルールあり）
${responseB}

## 評価基準
各回答を以下の基準で1〜5点で評価してください：
- accuracy（正確性）: ドキュメントの内容と一致しているか
- completeness（完全性）: 期待されるトピックをカバーしているか
- clarity（明瞭性）: 分かりやすく説明されているか
- relevance（関連性）: 質問に対して適切に回答しているか

## 出力形式（JSON）
{
  "winner": "A" | "B" | "tie",
  "scores": {
    "A": {
      "accuracy": 1-5,
      "completeness": 1-5,
      "clarity": 1-5,
      "relevance": 1-5
    },
    "B": {
      "accuracy": 1-5,
      "completeness": 1-5,
      "clarity": 1-5,
      "relevance": 1-5
    }
  },
  "reasoning": "評価理由の説明",
  "improvement_suggestions": ["改善提案1", "改善提案2"]
}

JSON以外の出力は不要です。`;
  }

  /**
   * 評価レスポンスをパース
   */
  private parseEvaluationResponse(
    response: string
  ): SelfEvaluationResult['evaluation'] | null {
    try {
      let jsonStr = response;

      // Remove markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Find JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonStr = objectMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // Normalize winner
      let winner: 'without_rule' | 'with_rule' | 'tie' = 'tie';
      const winnerStr = String(parsed.winner).toUpperCase();
      if (winnerStr === 'A') winner = 'without_rule';
      else if (winnerStr === 'B') winner = 'with_rule';
      else if (winnerStr === 'TIE') winner = 'tie';

      return {
        winner,
        scores: {
          without_rule: this.normalizeScores(parsed.scores?.A),
          with_rule: this.normalizeScores(parsed.scores?.B),
        },
        reasoning: parsed.reasoning || '',
        improvement_suggestions: parsed.improvement_suggestions || [],
      };
    } catch (error) {
      console.error('Failed to parse evaluation response:', error);
      return null;
    }
  }

  /**
   * スコアを正規化
   */
  private normalizeScores(scores: unknown): EvaluationScores {
    const defaultScores: EvaluationScores = {
      accuracy: 3,
      completeness: 3,
      clarity: 3,
      relevance: 3,
    };

    if (typeof scores !== 'object' || scores === null) {
      return defaultScores;
    }

    const s = scores as Record<string, unknown>;

    return {
      accuracy: this.normalizeScore(s.accuracy),
      completeness: this.normalizeScore(s.completeness),
      clarity: this.normalizeScore(s.clarity),
      relevance: this.normalizeScore(s.relevance),
    };
  }

  /**
   * 個別スコアを正規化
   */
  private normalizeScore(score: unknown): number {
    if (typeof score === 'number') {
      return Math.max(1, Math.min(5, score));
    }
    return 3;
  }

  /**
   * 複数回の評価結果を集約
   */
  private aggregateResults(results: SelfEvaluationResult[]): SelfEvaluationResult {
    if (results.length === 1) {
      return results[0];
    }

    // スコアを平均化
    const avgScoresWithout: EvaluationScores = {
      accuracy: 0,
      completeness: 0,
      clarity: 0,
      relevance: 0,
    };
    const avgScoresWith: EvaluationScores = {
      accuracy: 0,
      completeness: 0,
      clarity: 0,
      relevance: 0,
    };

    for (const result of results) {
      avgScoresWithout.accuracy += result.evaluation.scores.without_rule.accuracy;
      avgScoresWithout.completeness += result.evaluation.scores.without_rule.completeness;
      avgScoresWithout.clarity += result.evaluation.scores.without_rule.clarity;
      avgScoresWithout.relevance += result.evaluation.scores.without_rule.relevance;

      avgScoresWith.accuracy += result.evaluation.scores.with_rule.accuracy;
      avgScoresWith.completeness += result.evaluation.scores.with_rule.completeness;
      avgScoresWith.clarity += result.evaluation.scores.with_rule.clarity;
      avgScoresWith.relevance += result.evaluation.scores.with_rule.relevance;
    }

    const n = results.length;
    avgScoresWithout.accuracy /= n;
    avgScoresWithout.completeness /= n;
    avgScoresWithout.clarity /= n;
    avgScoresWithout.relevance /= n;

    avgScoresWith.accuracy /= n;
    avgScoresWith.completeness /= n;
    avgScoresWith.clarity /= n;
    avgScoresWith.relevance /= n;

    // 勝者を決定（多数決）
    const winCounts = { without_rule: 0, with_rule: 0, tie: 0 };
    for (const result of results) {
      winCounts[result.evaluation.winner]++;
    }

    let winner: 'without_rule' | 'with_rule' | 'tie' = 'tie';
    if (winCounts.with_rule > winCounts.without_rule) {
      winner = 'with_rule';
    } else if (winCounts.without_rule > winCounts.with_rule) {
      winner = 'without_rule';
    }

    // 改善提案を統合
    const allSuggestions = results.flatMap(r => r.evaluation.improvement_suggestions);
    const uniqueSuggestions = [...new Set(allSuggestions)];

    return {
      question: results[0].question,
      response_without_rule: results[0].response_without_rule,
      response_with_rule: results[0].response_with_rule,
      evaluation: {
        winner,
        scores: {
          without_rule: avgScoresWithout,
          with_rule: avgScoresWith,
        },
        reasoning: results.map(r => r.evaluation.reasoning).join(' | '),
        improvement_suggestions: uniqueSuggestions,
      },
    };
  }

  /**
   * 評価結果から弱点を特定
   */
  async identifyWeaknesses(
    evaluationResults: SelfEvaluationResult[],
    config: Partial<SelfEvolutionConfig> = {}
  ): Promise<DocumentWeakness[]> {
    const fullConfig = { ...DEFAULT_SELF_EVOLUTION_CONFIG, ...config };
    const weaknesses: DocumentWeakness[] = [];

    // 低スコアの質問を特定
    for (const result of evaluationResults) {
      const withoutRuleAvg = this.calculateAverageScore(result.evaluation.scores.without_rule);
      const withRuleAvg = this.calculateAverageScore(result.evaluation.scores.with_rule);

      // ルールなしのスコアが低い場合、弱点として記録
      if (withoutRuleAvg < 3.5) {
        const weakness = await this.analyzeWeakness(result);
        if (weakness) {
          weaknesses.push(weakness);
        }
      }

      // ルールありでも改善が見られない場合
      if (withRuleAvg < 3.5 && withRuleAvg - withoutRuleAvg < fullConfig.weaknessThreshold) {
        const weakness = await this.analyzeWeakness(result, true);
        if (weakness) {
          weaknesses.push(weakness);
        }
      }
    }

    return this.consolidateWeaknesses(weaknesses);
  }

  /**
   * 平均スコアを計算
   */
  private calculateAverageScore(scores: EvaluationScores): number {
    return (scores.accuracy + scores.completeness + scores.clarity + scores.relevance) / 4;
  }

  /**
   * 弱点を分析
   */
  private async analyzeWeakness(
    result: SelfEvaluationResult,
    persistentWeakness: boolean = false
  ): Promise<DocumentWeakness | null> {
    const prompt = `以下の評価結果を分析し、ドキュメントの弱点を特定してください。

## 質問
${result.question.question}

## 評価結果
- ルールなしスコア: ${JSON.stringify(result.evaluation.scores.without_rule)}
- ルールありスコア: ${JSON.stringify(result.evaluation.scores.with_rule)}
- 評価理由: ${result.evaluation.reasoning}
- 改善提案: ${result.evaluation.improvement_suggestions.join(', ')}

${persistentWeakness ? '## 注意: ルールを適用しても改善されていません。より根本的な問題を特定してください。' : ''}

## 出力形式（JSON）
{
  "type": "missing_context" | "ambiguous" | "incomplete" | "hard_to_find" | "misleading",
  "description": "弱点の説明",
  "suggested_rule_type": "CONTEXT" | "CLARIFICATION" | "FORMAT" | "MISUNDERSTANDING" | "RELATED",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.3,
        maxOutputTokens: 512,
      });

      return this.parseWeaknessResponse(response, result.question.question);
    } catch (error) {
      console.error('Failed to analyze weakness:', error);
      return null;
    }
  }

  /**
   * 弱点レスポンスをパース
   */
  private parseWeaknessResponse(
    response: string,
    questionText: string
  ): DocumentWeakness | null {
    try {
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

      const validTypes = ['missing_context', 'ambiguous', 'incomplete', 'hard_to_find', 'misleading'];
      const validRuleTypes: RuleType[] = ['CONTEXT', 'CLARIFICATION', 'FORMAT', 'MISUNDERSTANDING', 'RELATED'];

      return {
        type: validTypes.includes(parsed.type) ? parsed.type : 'ambiguous',
        description: parsed.description || 'Unknown weakness',
        affected_questions: [questionText],
        suggested_rule_type: validRuleTypes.includes(parsed.suggested_rule_type)
          ? parsed.suggested_rule_type
          : 'CONTEXT',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch (error) {
      console.error('Failed to parse weakness response:', error);
      return null;
    }
  }

  /**
   * 類似の弱点を統合
   */
  private consolidateWeaknesses(weaknesses: DocumentWeakness[]): DocumentWeakness[] {
    const consolidated: DocumentWeakness[] = [];

    for (const weakness of weaknesses) {
      // 同じタイプの弱点を探す
      const existing = consolidated.find(
        w => w.type === weakness.type && w.suggested_rule_type === weakness.suggested_rule_type
      );

      if (existing) {
        // 既存の弱点に質問を追加
        existing.affected_questions.push(...weakness.affected_questions);
        existing.confidence = Math.max(existing.confidence, weakness.confidence);
      } else {
        consolidated.push({ ...weakness });
      }
    }

    // 信頼度でソート
    return consolidated.sort((a, b) => b.confidence - a.confidence);
  }
}
