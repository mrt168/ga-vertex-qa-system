/**
 * Check Google Drive folder contents (all file types)
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

async function main() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log('Checking folder:', folderId);
  console.log('');

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    // First, try to get folder info
    console.log('1. Getting folder info...');
    const folderInfo = await drive.files.get({
      fileId: folderId!,
      fields: 'id, name, mimeType, owners',
    });
    console.log('Folder name:', folderInfo.data.name);
    console.log('Folder mimeType:', folderInfo.data.mimeType);
    console.log('');

    // List ALL files (no mimeType filter)
    console.log('2. Listing ALL files in folder...');
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });

    const files = response.data.files || [];
    console.log(`Found ${files.length} files:\n`);

    files.forEach((file, i) => {
      console.log(`  ${i + 1}. ${file.name}`);
      console.log(`     mimeType: ${file.mimeType}`);
      console.log(`     id: ${file.id}`);
      console.log('');
    });

    if (files.length === 0) {
      console.log('The folder appears to be empty or not accessible.');
      console.log('Please verify:');
      console.log('  1. The folder ID is correct');
      console.log('  2. The folder is shared with: qa-system-drive@convini-project.iam.gserviceaccount.com');
      console.log('  3. The folder contains files');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.code === 404) {
      console.log('\nFolder not found. Check the folder ID.');
    } else if (error.code === 403) {
      console.log('\nPermission denied. Make sure the folder is shared with:');
      console.log('  qa-system-drive@convini-project.iam.gserviceaccount.com');
    }
  }
}

main().catch(console.error);
