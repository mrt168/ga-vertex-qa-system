/**
 * Test Vertex AI Gemini API
 */

import { VertexAI } from '@google-cloud/vertexai';

async function main() {
  console.log('=== Testing Vertex AI Gemini ===\n');

  const projectId = process.env.GCP_PROJECT_ID || 'convini-project';
  const location = 'us-central1';

  console.log('Project:', projectId);
  console.log('Location:', location);
  console.log('');

  try {
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    // Try different models
    const models = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
    ];

    for (const modelName of models) {
      console.log(`\nTesting model: ${modelName}`);
      try {
        const model = vertexAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Hello, respond with just "OK"' }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
          },
        });

        const response = result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`  Response: ${text}`);
        console.log(`  SUCCESS!`);
        return; // Stop on first success
      } catch (error) {
        console.error(`  FAILED: ${(error as Error).message}`);
      }
    }

    console.log('\nAll models failed');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
