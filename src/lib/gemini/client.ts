import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GenerateContentRequest,
  Feedback,
  MutationType,
  EvaluationResult,
} from './types';
import { buildMutationPrompt, buildEvaluationPrompt } from './prompts';

const GEMINI_MODEL = 'gemini-3-pro-preview';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required');
    }
    this.genAI = new GoogleGenerativeAI(key);
  }

  /**
   * Generate content with Gemini
   */
  async generateContent(request: GenerateContentRequest): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: request.prompt as string }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    });

    const response = await result.response;
    return response.text();
  }

  /**
   * Generate content stream with Gemini
   */
  async *generateContentStream(request: GenerateContentRequest): AsyncGenerator<string> {
    const model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const result = await model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: request.prompt as string }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    });

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  /**
   * Generate multiple mutation candidates
   */
  async generateMutations(
    originalContent: string,
    feedbacks: Feedback[],
    mutationType: MutationType
  ): Promise<string[]> {
    const prompt = buildMutationPrompt(originalContent, feedbacks, mutationType);

    const candidates: string[] = [];

    // Generate 3 mutation candidates
    for (let i = 0; i < 3; i++) {
      try {
        const result = await this.generateContent({
          prompt,
          temperature: 0.8 + i * 0.1, // Vary temperature for diversity
        });
        candidates.push(result);
      } catch (error) {
        console.error(`Failed to generate mutation candidate ${i + 1}:`, error);
        // Continue to next candidate
      }
    }

    if (candidates.length === 0) {
      throw new Error('Failed to generate any mutation candidates');
    }

    return candidates;
  }

  /**
   * Evaluate two documents using pairwise comparison
   */
  async evaluateDocuments(
    question: string,
    docA: string,
    docB: string
  ): Promise<EvaluationResult> {
    const prompt = buildEvaluationPrompt(question, docA, docB);

    const result = await this.generateContent({
      prompt,
      temperature: 0.3, // Low temperature for consistent evaluation
    });

    try {
      // Extract JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in evaluation response');
      }

      const evaluation = JSON.parse(jsonMatch[0]) as EvaluationResult;

      // Validate evaluation structure
      if (!evaluation.winner || !evaluation.scores || !evaluation.reasoning) {
        throw new Error('Invalid evaluation format');
      }

      return evaluation;
    } catch (error) {
      console.error('Failed to parse evaluation result:', error);
      console.error('Raw result:', result);

      // Return default evaluation favoring original (A)
      return {
        winner: 'A',
        scores: {
          A: { correctness: 3, helpfulness: 3, clarity: 3 },
          B: { correctness: 2, helpfulness: 2, clarity: 2 },
        },
        reasoning: 'Evaluation parsing failed, defaulting to original document',
      };
    }
  }
}

// Export singleton instance for server-side use
let geminiClient: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!geminiClient) {
    geminiClient = new GeminiClient();
  }
  return geminiClient;
}
