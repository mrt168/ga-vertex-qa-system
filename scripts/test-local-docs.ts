/**
 * Test local document search functionality
 */

import { LocalDocumentSource } from '../src/lib/documents/local-source';

async function main() {
  console.log('=== Testing Local Document Source ===\n');

  const source = new LocalDocumentSource();

  // Test 1: List all documents
  console.log('1. Listing all documents...\n');
  const docs = await source.listDocuments();
  console.log(`Found ${docs.length} documents:\n`);
  docs.forEach((doc, i) => {
    console.log(`  ${i + 1}. ${doc.name}`);
    console.log(`     ID: ${doc.id}`);
    console.log(`     Content length: ${doc.content.length} chars`);
    console.log('');
  });

  // Test 2: Search for documents
  const searchQueries = ['有給', '経費', '会社'];

  for (const query of searchQueries) {
    console.log(`\n2. Searching for: "${query}"\n`);
    const results = await source.searchWithSnippets(query, 200);
    console.log(`Found ${results.length} results:\n`);
    results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.document.name} (relevance: ${result.relevance})`);
      console.log(`     Snippet: ${result.snippet.substring(0, 100)}...`);
      console.log('');
    });
  }

  // Test 3: Get specific document
  console.log('\n3. Getting specific document...\n');
  const doc = await source.getDocument('会社概要');
  if (doc) {
    console.log(`Document: ${doc.name}`);
    console.log(`Content:\n${doc.content}`);
  } else {
    console.log('Document not found');
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
