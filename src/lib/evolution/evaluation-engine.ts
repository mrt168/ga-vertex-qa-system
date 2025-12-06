/**
 * Evaluation Engine (AutoSxS - Pairwise Evaluation)
 * Geminiを使用してドキュメント候補のペアワイズ評価を実行
 */

import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import { DocumentCandidate, EvaluationResult } from './types';

interface QAPair {
  question: string;
  expectedTopics: string[];
}

const EVALUATION_SYSTEM_PROMPT = `あなたは公平な評価者です。
2つの異なるドキュメントを参照して生成された回答を比較評価してください。

## 評価基準

1. **Helpfulness（有用性）**: 回答がユーザーの質問に対して実用的で役立つ情報を提供しているか
   - 5点: 非常に役立つ、具体的なアクションが取れる
   - 3点: まあまあ役立つ、基本的な情報は得られる
   - 1点: あまり役立たない、情報が不足または不適切

2. **Correctness（正確性）**: 回答の内容が正確で、誤りがないか
   - 5点: 完全に正確、事実に基づいている
   - 3点: おおむね正確、軽微な不正確さがある
   - 1点: 不正確な情報が含まれている

3. **Coherence（一貫性）**: 回答が論理的で、読みやすく構成されているか
   - 5点: 非常に論理的で読みやすい
   - 3点: おおむね論理的
   - 1点: 論理的でない、読みにくい

## 出力形式
以下のJSON形式で出力してください:
{
  "winner": "A" または "B" または "TIE",
  "scores": {
    "A": { "helpfulness": 1-5, "correctness": 1-5, "coherence": 1-5 },
    "B": { "helpfulness": 1-5, "correctness": 1-5, "coherence": 1-5 }
  },
  "reasoning": "判定理由（簡潔に）"
}`;

export class EvaluationEngine {
  private gemini = getVertexGeminiClient();

  /**
   * 候補ドキュメントを現行ドキュメントと比較評価
   */
  async evaluateCandidates(
    originalContent: string,
    candidates: DocumentCandidate[],
    sampleQuestions: QAPair[]
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const candidate of candidates) {
      try {
        const result = await this.evaluateSingleCandidate(
          originalContent,
          candidate,
          sampleQuestions
        );
        results.push(result);
      } catch (error) {
        console.error(`Evaluation failed for candidate ${candidate.id}:`, error);
        // エラー時は低スコアで記録
        results.push({
          candidateId: candidate.id,
          score: 0,
          winRate: 0,
          metrics: { helpfulness: 0, correctness: 0, coherence: 0 },
        });
      }
    }

    return results;
  }

  /**
   * 単一の候補を評価
   */
  private async evaluateSingleCandidate(
    originalContent: string,
    candidate: DocumentCandidate,
    sampleQuestions: QAPair[]
  ): Promise<EvaluationResult> {
    let totalWins = 0;
    let totalLosses = 0;
    let totalTies = 0;
    const allMetrics = {
      helpfulness: [] as number[],
      correctness: [] as number[],
      coherence: [] as number[],
    };

    // 各サンプル質問で評価
    for (const qa of sampleQuestions) {
      const comparison = await this.runPairwiseComparison(
        originalContent,
        candidate.content,
        qa.question
      );

      if (comparison.winner === 'B') {
        totalWins++;
      } else if (comparison.winner === 'A') {
        totalLosses++;
      } else {
        totalTies++;
      }

      allMetrics.helpfulness.push(comparison.candidateScores.helpfulness);
      allMetrics.correctness.push(comparison.candidateScores.correctness);
      allMetrics.coherence.push(comparison.candidateScores.coherence);
    }

    const totalComparisons = totalWins + totalLosses + totalTies;
    const winRate = totalComparisons > 0 ? totalWins / totalComparisons : 0;

    // 平均スコアを計算
    const avgMetrics = {
      helpfulness: this.average(allMetrics.helpfulness),
      correctness: this.average(allMetrics.correctness),
      coherence: this.average(allMetrics.coherence),
    };

    const score = (avgMetrics.helpfulness + avgMetrics.correctness + avgMetrics.coherence) / 3;

    return {
      candidateId: candidate.id,
      score: Math.round(score * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      metrics: avgMetrics,
      comparisonDetails: {
        originalScore: 0, // 個別比較では記録しない
        candidateScore: score,
        winner: winRate > 0.5 ? 'candidate' : winRate < 0.5 ? 'original' : 'tie',
      },
    };
  }

  /**
   * ペアワイズ比較を実行
   */
  private async runPairwiseComparison(
    originalContent: string,
    candidateContent: string,
    question: string
  ): Promise<{
    winner: 'A' | 'B' | 'TIE';
    originalScores: { helpfulness: number; correctness: number; coherence: number };
    candidateScores: { helpfulness: number; correctness: number; coherence: number };
  }> {
    // まず両方のドキュメントから回答を生成
    const [responseA, responseB] = await Promise.all([
      this.generateResponse(originalContent, question),
      this.generateResponse(candidateContent, question),
    ]);

    // 比較評価を実行
    const evaluationPrompt = `${EVALUATION_SYSTEM_PROMPT}

## 質問
${question}

## ドキュメントAを参照した回答
${responseA}

## ドキュメントBを参照した回答
${responseB}

上記の回答を評価し、JSON形式で結果を出力してください。`;

    const result = await this.gemini.generateContent({
      prompt: evaluationPrompt,
      temperature: 0.3, // 評価は低めの温度で
      maxOutputTokens: 1024,
    });

    try {
      const parsed = this.parseEvaluationResult(result);
      return {
        winner: parsed.winner,
        originalScores: parsed.scores.A,
        candidateScores: parsed.scores.B,
      };
    } catch {
      // パース失敗時はTIEとする
      return {
        winner: 'TIE',
        originalScores: { helpfulness: 3, correctness: 3, coherence: 3 },
        candidateScores: { helpfulness: 3, correctness: 3, coherence: 3 },
      };
    }
  }

  /**
   * ドキュメントを参照して回答を生成
   */
  private async generateResponse(documentContent: string, question: string): Promise<string> {
    const prompt = `以下のドキュメントを参照して、質問に回答してください。

## ドキュメント
${documentContent}

## 質問
${question}

回答:`;

    return await this.gemini.generateContent({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });
  }

  /**
   * 評価結果をパース
   */
  private parseEvaluationResult(result: string): {
    winner: 'A' | 'B' | 'TIE';
    scores: {
      A: { helpfulness: number; correctness: number; coherence: number };
      B: { helpfulness: number; correctness: number; coherence: number };
    };
  } {
    // JSON部分を抽出
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON not found in evaluation result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      winner: parsed.winner === 'A' ? 'A' : parsed.winner === 'B' ? 'B' : 'TIE',
      scores: {
        A: {
          helpfulness: parsed.scores?.A?.helpfulness || 3,
          correctness: parsed.scores?.A?.correctness || 3,
          coherence: parsed.scores?.A?.coherence || 3,
        },
        B: {
          helpfulness: parsed.scores?.B?.helpfulness || 3,
          correctness: parsed.scores?.B?.correctness || 3,
          coherence: parsed.scores?.B?.coherence || 3,
        },
      },
    };
  }

  /**
   * 配列の平均を計算
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Singleton instance
let evaluationEngine: EvaluationEngine | null = null;

export function getEvaluationEngine(): EvaluationEngine {
  if (!evaluationEngine) {
    evaluationEngine = new EvaluationEngine();
  }
  return evaluationEngine;
}
