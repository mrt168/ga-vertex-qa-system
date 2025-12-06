/**
 * Test QA Core functionality (document search + Gemini response)
 * Bypasses authentication to test core logic directly
 */

import { LocalDocumentSource } from '../src/lib/documents/local-source';
import { VertexAI } from '@google-cloud/vertexai';

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

async function main() {
  console.log('=== Testing QA Core Functionality ===\n');

  const projectId = process.env.GCP_PROJECT_ID || 'convini-project';
  const location = process.env.VERTEX_LOCATION || 'us-central1';

  console.log('Project:', projectId);
  console.log('Location:', location);
  console.log('');

  // 1. Test local document search
  console.log('1. Searching for relevant documents...\n');
  const query = '有給休暇の付与日数を教えてください';
  console.log(`Query: "${query}"\n`);

  const localSource = new LocalDocumentSource();
  const searchResults = await localSource.searchWithSnippets(query, 500);

  console.log(`Found ${searchResults.length} documents:\n`);
  searchResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.document.name} (relevance: ${result.relevance})`);
  });
  console.log('');

  // 2. Build context from documents
  console.log('2. Building context from documents...\n');
  const sources = searchResults.slice(0, 5).map(result => ({
    documentId: `local:${result.document.id}`,
    fileName: result.document.name,
    relevantContent: result.document.content.slice(0, 2000),
  }));

  const context = sources.length > 0
    ? sources.map(s => `[${s.fileName}]\n${s.relevantContent}`).join('\n\n---\n\n')
    : '';

  console.log('Context built from', sources.length, 'documents');
  console.log('Context preview (first 500 chars):');
  console.log(context.slice(0, 500) + '...');
  console.log('');

  // 3. Generate response with Gemini
  console.log('3. Generating response with Gemini...\n');

  const systemPrompt = `You are a helpful internal QA assistant. Answer questions based on the company's knowledge base.
Be concise, accurate, and helpful. If you're not sure about something, say so.
Always respond in the same language as the user's question.

Here is relevant information from the knowledge base:

${context}

Based on this context, answer the user's question. If the context doesn't contain relevant information, you may provide general guidance but indicate that it's not from the official knowledge base.`;

  const fullPrompt = `${systemPrompt}\n\nUser Question: ${query}`;

  try {
    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log('=== Generated Response ===\n');
    console.log(text);
    console.log('\n=== Sources Used ===\n');
    sources.forEach(s => {
      console.log(`- ${s.fileName}`);
    });

    console.log('\n=== Test Complete: SUCCESS ===');
  } catch (error) {
    console.error('Gemini error:', error);
    console.log('\n=== Test Complete: FAILED ===');
  }
}

main().catch(console.error);
