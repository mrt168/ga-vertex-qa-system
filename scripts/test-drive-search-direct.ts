/**
 * Test Google Drive search directly (without API auth)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getGoogleDriveSource } from '../src/lib/documents/google-drive-source';
import { getVertexGeminiClient } from '../src/lib/gemini/vertex-client';

async function main() {
  console.log('=== Testing Google Drive Search + Gemini ===\n');

  // 1. Search documents
  const driveSource = getGoogleDriveSource();
  const query = 'SEOの基本的な施策について教えてください';

  console.log(`Query: "${query}"\n`);
  console.log('1. Searching Google Drive documents...');

  const results = await driveSource.searchWithSnippets(query, 500);
  console.log(`   Found ${results.length} results\n`);

  // Get top 5 results
  const sources = results.slice(0, 5).map(result => ({
    documentId: `drive:${result.document.id}`,
    fileName: result.document.name,
    relevantContent: result.document.content.slice(0, 2000),
  }));

  console.log('   Top sources:');
  sources.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.fileName}`);
  });

  // 2. Build context
  const context = sources.length > 0
    ? sources.map(s => `[${s.fileName}]\n${s.relevantContent}`).join('\n\n---\n\n')
    : '';

  // 3. Generate response with Gemini
  console.log('\n2. Generating response with Vertex AI Gemini...');

  const gemini = getVertexGeminiClient();
  const systemPrompt = `You are a helpful internal QA assistant. Answer questions based on the company's knowledge base.
Be concise, accurate, and helpful. If you're not sure about something, say so.
Always respond in the same language as the user's question.

Here is relevant information from the knowledge base:

${context}

Based on this context, answer the user's question.`;

  const response = await gemini.generateContent({
    prompt: `${systemPrompt}\n\nUser Question: ${query}`,
    temperature: 0.7,
    maxOutputTokens: 2048,
  });

  console.log('\n=== Gemini Response ===');
  console.log(response);

  console.log('\n\n=== Sources Used ===');
  sources.forEach((s, i) => {
    console.log(`${i + 1}. ${s.fileName}`);
  });

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
