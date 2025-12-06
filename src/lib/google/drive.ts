import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';

// Types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive;

  constructor() {
    // Use Application Default Credentials (ADC)
    // For local development: run `gcloud auth application-default login`
    // For production: use service account or workload identity
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    });

    this.drive = google.drive({ version: 'v3', auth: auth as unknown as drive_v3.Options['auth'] });
  }

  /**
   * List Markdown files in a folder
   */
  async listMarkdownFiles(folderId: string): Promise<DriveFile[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType='text/markdown' and trashed=false`,
        fields: 'files(id, name, mimeType, modifiedTime, createdTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
      });

      return (response.data.files || []) as DriveFile[];
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  }

  /**
   * Get file content as text
   */
  async getFileContent(fileId: string): Promise<string> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        let data = '';
        const stream = response.data as Readable;
        stream
          .on('data', (chunk) => (data += chunk))
          .on('end', () => resolve(data))
          .on('error', (err) => reject(err));
      });
    } catch (error) {
      console.error('Failed to get file content:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<DriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, createdTime',
      });

      return response.data as DriveFile;
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Upload a new Markdown file
   */
  async uploadMarkdown(
    fileName: string,
    content: string,
    folderId: string
  ): Promise<string> {
    try {
      const bufferStream = new Readable();
      bufferStream.push(content);
      bufferStream.push(null);

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        mimeType: 'text/markdown',
      };

      const media = {
        mimeType: 'text/markdown',
        body: bufferStream,
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id',
      });

      return response.data.id!;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Update file content (for GA evolution)
   */
  async updateFileContent(fileId: string, newContent: string): Promise<boolean> {
    try {
      const bufferStream = new Readable();
      bufferStream.push(newContent);
      bufferStream.push(null);

      const media = {
        mimeType: 'text/markdown',
        body: bufferStream,
      };

      await this.drive.files.update({
        fileId,
        media,
        fields: 'id, modifiedTime',
      });

      return true;
    } catch (error) {
      console.error('Failed to update file:', error);
      return false;
    }
  }

  /**
   * Create a new version of a file (copy for evolution tracking)
   */
  async createVersion(
    fileId: string,
    newName: string,
    folderId: string
  ): Promise<string> {
    try {
      const response = await this.drive.files.copy({
        fileId,
        requestBody: {
          name: newName,
          parents: [folderId],
        },
        fields: 'id',
      });

      return response.data.id!;
    } catch (error) {
      console.error('Failed to create version:', error);
      throw error;
    }
  }

  /**
   * List folders in a parent folder
   */
  async listFolders(parentFolderId: string): Promise<DriveFolder[]> {
    try {
      const response = await this.drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'name',
      });

      return (response.data.files || []) as DriveFolder[];
    } catch (error) {
      console.error('Failed to list folders:', error);
      throw error;
    }
  }

  /**
   * Search for files by name
   */
  async searchFiles(query: string, folderId?: string): Promise<DriveFile[]> {
    try {
      let q = `name contains '${query}' and mimeType='text/markdown' and trashed=false`;
      if (folderId) {
        q = `'${folderId}' in parents and ${q}`;
      }

      const response = await this.drive.files.list({
        q,
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 20,
      });

      return (response.data.files || []) as DriveFile[];
    } catch (error) {
      console.error('Failed to search files:', error);
      throw error;
    }
  }
}

// Singleton instance for server-side use
let driveClient: GoogleDriveClient | null = null;

export function getGoogleDriveClient(): GoogleDriveClient {
  if (!driveClient) {
    driveClient = new GoogleDriveClient();
  }
  return driveClient;
}
