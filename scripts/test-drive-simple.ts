/**
 * Simple Google Drive connection test
 * Uses default ADC without specifying scopes
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  console.log('=== Simple Google Drive Test ===\n');

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1muBN_AjmNVj-THLHxJOifGO-dbyF87kj';
  console.log('Target Folder ID:', folderId);

  try {
    // Try without specifying scopes - use whatever is in ADC
    const auth = new GoogleAuth();
    const authClient = await auth.getClient();

    const drive = google.drive({ version: 'v3', auth: authClient as Parameters<typeof google.drive>[0]['auth'] });

    // List files in the specific folder
    console.log('\nListing files in folder...\n');

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 10,
    });

    const files = response.data.files || [];
    console.log(`Found ${files.length} files:\n`);

    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name}`);
      console.log(`     ID: ${file.id}`);
      console.log(`     Type: ${file.mimeType}`);
      console.log(`     Modified: ${file.modifiedTime}`);
      console.log('');
    });

    if (files.length > 0) {
      // Try to read content of first file
      const firstFile = files[0];
      console.log(`\n--- Reading content of: ${firstFile.name} ---\n`);

      const contentResponse = await drive.files.get(
        { fileId: firstFile.id!, alt: 'media' },
        { responseType: 'text' }
      );

      const content = contentResponse.data as string;
      console.log(content.substring(0, 500));
      if (content.length > 500) {
        console.log('... (truncated)');
      }
    }

    console.log('\n=== SUCCESS ===');
  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

main();
