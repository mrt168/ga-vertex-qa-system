/**
 * GCP Connection Test Script
 * Tests Google Drive API and Vertex AI Search connectivity
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

async function testGoogleDriveConnection() {
  console.log('=== Testing Google Drive API Connection ===\n');

  try {
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    });

    const drive = google.drive({ version: 'v3', auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'] });

    // List files (just to test connectivity)
    const response = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)',
    });

    console.log('Google Drive API Connection: SUCCESS');
    console.log(`Found ${response.data.files?.length || 0} files:\n`);

    response.data.files?.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name} (${file.mimeType})`);
    });

    return true;
  } catch (error) {
    console.error('Google Drive API Connection: FAILED');
    console.error('Error:', error);
    return false;
  }
}

async function testVertexAISearchConnection() {
  console.log('\n=== Testing Vertex AI Search Connection ===\n');

  const projectId = process.env.GCP_PROJECT_ID || 'convini-project';
  const dataStoreId = process.env.VERTEX_DATASTORE_ID;

  if (!dataStoreId) {
    console.log('Vertex AI Search: SKIPPED (VERTEX_DATASTORE_ID not set)');
    console.log('To test Vertex AI Search, set VERTEX_DATASTORE_ID environment variable');
    return null;
  }

  try {
    const { SearchServiceClient } = await import('@google-cloud/discoveryengine');
    const client = new SearchServiceClient();

    const servingConfig = client.projectLocationCollectionDataStoreServingConfigPath(
      projectId,
      'global',
      'default_collection',
      dataStoreId,
      'default_search'
    );

    console.log('Vertex AI Search Client: INITIALIZED');
    console.log(`Serving Config Path: ${servingConfig}`);

    // Try a simple search
    const searchIterable = client.searchAsync({
      servingConfig,
      query: 'test',
      pageSize: 1,
    });

    let resultCount = 0;
    for await (const _ of searchIterable) {
      resultCount++;
      break;
    }

    console.log('Vertex AI Search Connection: SUCCESS');
    return true;
  } catch (error) {
    console.error('Vertex AI Search Connection: FAILED');
    console.error('Error:', error);
    return false;
  }
}

async function main() {
  console.log('GCP Connection Test\n');
  console.log('Project ID:', process.env.GCP_PROJECT_ID || 'convini-project');
  console.log('Data Store ID:', process.env.VERTEX_DATASTORE_ID || '(not set)');
  console.log('');

  const driveResult = await testGoogleDriveConnection();
  const searchResult = await testVertexAISearchConnection();

  console.log('\n=== Summary ===');
  console.log(`Google Drive API: ${driveResult ? 'OK' : 'FAILED'}`);
  console.log(`Vertex AI Search: ${searchResult === null ? 'SKIPPED' : searchResult ? 'OK' : 'FAILED'}`);
}

main().catch(console.error);
