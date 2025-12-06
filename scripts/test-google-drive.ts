/**
 * Test Google Drive document source
 */

import { GoogleDriveSource } from '../src/lib/documents/google-drive-source';

async function main() {
  console.log('=== Testing Google Drive Document Source ===\n');

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log('Folder ID:', folderId);
  console.log('');

  if (!folderId) {
    console.error('GOOGLE_DRIVE_FOLDER_ID is not set');
    return;
  }

  const source = new GoogleDriveSource(folderId);

  // 1. List documents
  console.log('1. Listing documents in folder...\n');
  try {
    const documents = await source.listDocuments();
    console.log(`Found ${documents.length} documents:\n`);

    documents.forEach((doc, i) => {
      console.log(`  ${i + 1}. ${doc.name}`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Type: ${doc.mimeType}`);
      console.log(`     Modified: ${doc.modifiedTime}`);
      console.log(`     Content preview: ${doc.content.slice(0, 100)}...`);
      console.log('');
    });

    if (documents.length === 0) {
      console.log('No documents found. Make sure:');
      console.log('  1. The folder contains Google Docs or text files');
      console.log('  2. The folder is shared with the service account email:');
      console.log('     qa-system-drive@convini-project.iam.gserviceaccount.com');
      return;
    }

    // 2. Search test
    console.log('\n2. Testing search functionality...\n');
    const query = '有給休暇';
    console.log(`Search query: "${query}"\n`);

    const searchResults = await source.searchWithSnippets(query, 200);
    console.log(`Found ${searchResults.length} matching documents:\n`);

    searchResults.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.document.name} (relevance: ${result.relevance})`);
      console.log(`     Snippet: ${result.snippet.slice(0, 150)}...`);
      console.log('');
    });

    console.log('\n=== Test Complete: SUCCESS ===');
  } catch (error) {
    console.error('Error:', error);
    console.log('\n=== Test Complete: FAILED ===');
    console.log('\nTroubleshooting:');
    console.log('  1. Ensure GOOGLE_APPLICATION_CREDENTIALS is set');
    console.log('  2. Share the folder with: qa-system-drive@convini-project.iam.gserviceaccount.com');
    console.log('  3. Grant "Viewer" access to the service account');
  }
}

main().catch(console.error);
