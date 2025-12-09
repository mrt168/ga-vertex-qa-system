/**
 * Interpretation Evaluation Engine
 * 解釈ルール候補をペアワイズ評価
 */

import { VertexGeminiClient } from '@/lib/gemini/vertex-client';
import {
  InterpretationCandidate,
  InterpretationEvaluationResult,
} from './types';
import {
  buildBasicRAGPrompt,
  buildRAGPromptWithInterpretation,
  buildInterpretationEvaluationPrompt,
} from './prompt-builder';
import { InterpretationRule } from './types';

interface DocumentContent {
  id: string;
  content: string;
  name: string;
}

interface ComparisonResult {
  winner: 'A' | 'B' | 'TIE';
  scores: {
    A: { correctness: number; helpfulness: number; coherence: number };
    B: { correctness: number; helpfulness: number; coherence: number };
  };
  reasoning: string;
}

export class InterpretationEvaluationEngine {
  constructor(private geminiClient: VertexGeminiClient) {}

  /**
   * 候補ルールをペアワイズ評価
   * ルールなしの回答 vs ルールありの回答を比較
   */
  async evaluateCandidates(
    document: DocumentContent,
    candidates: InterpretationCandidate[],
    sampleQuestions: string[]
  ): Promise<InterpretationEvaluationResult[]> {
    const results: InterpretationEvaluationResult[] = [];

    for (const candidate of candidates) {
      const result = await this.evaluateCandidate(
        document,
        candidate,
        sampleQuestions
      );
      results.push(result);
    }

    return results;
  }

  /**
   * 単一の候補を評価
   */
  private async evaluateCandidate(
    document: DocumentContent,
    candidate: InterpretationCandidate,
    sampleQuestions: string[]
  ): Promise<InterpretationEvaluationResult> {
    let totalWins = 0;
    let totalComparisons = 0;
    let totalScoreA = { correctness: 0, helpfulness: 0, coherence: 0 };
    let totalScoreB = { correctness: 0, helpfulness: 0, coherence: 0 };

    // Create a temporary rule object for evaluation
    const tempRule: InterpretationRule = {
      id: 'temp-evaluation',
      document_id: document.id,
      rule_type: candidate.rule_type,
      content: candidate.content,
      trigger_pattern: candidate.trigger_pattern || null,
      generation: 0,
      score: 0.5,
      enabled: true,
      source_feedback_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    for (const question of sampleQuestions) {
      try {
        // Generate response WITHOUT rule
        const promptWithoutRule = buildBasicRAGPrompt(question, document.content);
        const responseWithoutRule = await this.geminiClient.generateContent({
          prompt: promptWithoutRule,
          temperature: 0.5,
          maxOutputTokens: 1024,
        });

        // Generate response WITH rule
        const promptWithRule = buildRAGPromptWithInterpretation(
          question,
          document.content,
          [tempRule]
        );
        const responseWithRule = await this.geminiClient.generateContent({
          prompt: promptWithRule,
          temperature: 0.5,
          maxOutputTokens: 1024,
        });

        // Compare responses
        const comparison = await this.runPairwiseComparison(
          question,
          responseWithoutRule,
          responseWithRule
        );

        if (comparison) {
          totalComparisons++;

          if (comparison.winner === 'B') {
            totalWins++;
          } else if (comparison.winner === 'TIE') {
            totalWins += 0.5;
          }

          // Accumulate scores
          totalScoreA.correctness += comparison.scores.A.correctness;
          totalScoreA.helpfulness += comparison.scores.A.helpfulness;
          totalScoreA.coherence += comparison.scores.A.coherence;
          totalScoreB.correctness += comparison.scores.B.correctness;
          totalScoreB.helpfulness += comparison.scores.B.helpfulness;
          totalScoreB.coherence += comparison.scores.B.coherence;
        }
      } catch (error) {
        console.error(`Evaluation failed for question: ${question}`, error);
      }
    }

    // Calculate averages
    const avgScoreB =
      totalComparisons > 0
        ? {
            correctness: totalScoreB.correctness / totalComparisons,
            helpfulness: totalScoreB.helpfulness / totalComparisons,
            coherence: totalScoreB.coherence / totalComparisons,
          }
        : { correctness: 0, helpfulness: 0, coherence: 0 };

    const avgScore =
      (avgScoreB.correctness + avgScoreB.helpfulness + avgScoreB.coherence) / 3;

    const winRate = totalComparisons > 0 ? totalWins / totalComparisons : 0;

    return {
      candidate,
      win_rate: winRate,
      avg_score: avgScore,
      sample_comparisons: totalComparisons,
      metrics: {
        helpfulness: avgScoreB.helpfulness,
        correctness: avgScoreB.correctness,
        coherence: avgScoreB.coherence,
      },
    };
  }

  /**
   * ペアワイズ比較を実行
   */
  private async runPairwiseComparison(
    question: string,
    responseWithoutRule: string,
    responseWithRule: string
  ): Promise<ComparisonResult | null> {
    const prompt = buildInterpretationEvaluationPrompt(
      question,
      responseWithoutRule,
      responseWithRule
    );

    try {
      const response = await this.geminiClient.generateContent({
        prompt,
        temperature: 0.3, // Lower temperature for more consistent evaluation
        maxOutputTokens: 512,
      });

      return this.parseComparisonResult(response);
    } catch (error) {
      console.error('Pairwise comparison failed:', error);
      return null;
    }
  }

  /**
   * 比較結果をパース
   */
  private parseComparisonResult(response: string): ComparisonResult | null {
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

      // Validate structure
      if (!parsed.winner || !parsed.scores || !parsed.scores.A || !parsed.scores.B) {
        console.warn('Invalid comparison result structure:', parsed);
        return null;
      }

      // Normalize winner value
      let winner: 'A' | 'B' | 'TIE' = 'TIE';
      const winnerStr = String(parsed.winner).toUpperCase();
      if (winnerStr === 'A') winner = 'A';
      else if (winnerStr === 'B') winner = 'B';
      else if (winnerStr === 'TIE' || winnerStr === 'DRAW') winner = 'TIE';

      return {
        winner,
        scores: {
          A: {
            correctness: Number(parsed.scores.A.correctness) || 3,
            helpfulness: Number(parsed.scores.A.helpfulness) || 3,
            coherence: Number(parsed.scores.A.coherence) || 3,
          },
          B: {
            correctness: Number(parsed.scores.B.correctness) || 3,
            helpfulness: Number(parsed.scores.B.helpfulness) || 3,
            coherence: Number(parsed.scores.B.coherence) || 3,
          },
        },
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      console.error('Failed to parse comparison result:', error);
      console.error('Response was:', response);
      return null;
    }
  }
}
