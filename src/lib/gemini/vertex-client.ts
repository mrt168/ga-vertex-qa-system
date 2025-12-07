/**
 * Vertex AI Gemini Client
 * Uses ADC (Application Default Credentials) or explicit service account for authentication
 */

import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import {
  GenerateContentRequest,
  Feedback,
  MutationType,
  EvaluationResult,
} from './types';
import { buildMutationPrompt, buildEvaluationPrompt } from './prompts';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

export class VertexGeminiClient {
  private vertexAI: VertexAI;
  private model: GenerativeModel;

  constructor() {
    const projectId = process.env.GCP_PROJECT_ID || 'convini-project';
    const location = process.env.VERTEX_LOCATION || 'us-central1';

    // Support both ADC and explicit service account JSON from environment variable
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      // Use service account credentials from environment variable (for Vercel)
      try {
        const credentials = JSON.parse(serviceAccountJson);
        this.vertexAI = new VertexAI({
          project: projectId,
          location: location,
          googleAuthOptions: {
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          },
        });
      } catch (e) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON for VertexAI:', e);
        // Fallback to default ADC
        this.vertexAI = new VertexAI({
          project: projectId,
          location: location,
        });
      }
    } else {
      // Use default Application Default Credentials
      this.vertexAI = new VertexAI({
        project: projectId,
        location: location,
      });
    }

    this.model = this.vertexAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });
  }

  /**
   * Generate content with Gemini via Vertex AI
   */
  async generateContent(request: GenerateContentRequest): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: request.prompt as string }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    });

    const response = await result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text in Gemini response');
    }

    return text;
  }

  /**
   * Generate content stream with Gemini via Vertex AI
   */
  async *generateContentStream(request: GenerateContentRequest): AsyncGenerator<string> {
    const streamResult = await this.model.generateContentStream({
      contents: [{ role: 'user', parts: [{ text: request.prompt as string }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxOutputTokens ?? 2048,
      },
    });

    for await (const chunk of streamResult.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
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
let vertexClient: VertexGeminiClient | null = null;

export function getVertexGeminiClient(): VertexGeminiClient {
  if (!vertexClient) {
    vertexClient = new VertexGeminiClient();
  }
  return vertexClient;
}
