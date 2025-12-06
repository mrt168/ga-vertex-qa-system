/**
 * Test search functionality
 */

import { GoogleDriveSource } from '../src/lib/documents/google-drive-source';

async function main() {
  const source = new GoogleDriveSource(process.env.GOOGLE_DRIVE_FOLDER_ID);

  console.log('検索: "SEO"');
  const results = await source.searchWithSnippets('SEO', 200);
  console.log(`マッチ数: ${results.length}`);
  results.slice(0, 5).forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.document.name} (relevance: ${r.relevance})`);
    console.log(`     ${r.snippet.slice(0, 100)}...`);
  });
}

main().catch(console.error);
