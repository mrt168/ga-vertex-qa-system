/**
 * Google Drive Document Source
 * Reads documents from Google Drive using the Google Drive API
 */

import { google, drive_v3 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { extractText } from 'unpdf';

// Parse PDF buffer to text using unpdf (serverless-compatible)
async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    // Convert Buffer to Uint8Array (required by unpdf)
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const result = await extractText(uint8Array);
    // extractText returns { text: string, totalPages: number }
    const text = result?.text;
    if (typeof text === 'string') {
      return text;
    }
    // Handle case where text is an array of strings (per page)
    if (Array.isArray(text)) {
      return text.join('\n');
    }
    console.warn('PDF extraction returned unexpected format:', typeof result);
    return '';
  } catch (error) {
    console.error('PDF parse error:', error);
    return ''; // Return empty string instead of throwing to allow processing other files
  }
}

export interface DriveDocument {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

export class GoogleDriveSource {
  private drive: drive_v3.Drive | null = null;
  private folderId: string;

  constructor(folderId?: string) {
    this.folderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  }

  /**
   * Initialize the Google Drive client
   */
  private async getClient(): Promise<drive_v3.Drive> {
    if (this.drive) {
      return this.drive;
    }

    // Support both ADC and explicit service account JSON from environment variable
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    let authOptions: ConstructorParameters<typeof GoogleAuth>[0] = {
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    };

    if (serviceAccountJson) {
      // Use service account credentials from environment variable (for Vercel)
      try {
        const credentials = JSON.parse(serviceAccountJson);
        authOptions = {
          ...authOptions,
          credentials,
        };
      } catch (e) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e);
      }
    }

    const auth = new GoogleAuth(authOptions);
    this.drive = google.drive({ version: 'v3', auth: auth as unknown as drive_v3.Options['auth'] });
    return this.drive;
  }

  /**
   * List all documents in the configured folder
   */
  async listDocuments(): Promise<DriveDocument[]> {
    try {
      const drive = await this.getClient();

      // Query for files in the folder (Google Docs, text files, and PDFs)
      const query = `'${this.folderId}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/pdf')`;

      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
      });

      const files = response.data.files || [];
      const documents: DriveDocument[] = [];

      for (const file of files) {
        if (file.id && file.name) {
          try {
            const content = await this.getDocumentContent(file.id, file.mimeType || '');
            documents.push({
              id: file.id,
              name: file.name,
              content,
              mimeType: file.mimeType || '',
              modifiedTime: file.modifiedTime || new Date().toISOString(),
              webViewLink: file.webViewLink || undefined,
            });
          } catch (err) {
            console.error(`Failed to get content for ${file.name}:`, err);
          }
        }
      }

      return documents;
    } catch (error) {
      console.error('Failed to list Google Drive documents:', error);
      return [];
    }
  }

  /**
   * Get the content of a specific document
   */
  private async getDocumentContent(fileId: string, mimeType: string): Promise<string> {
    const drive = await this.getClient();

    // For Google Docs, export as plain text
    if (mimeType === 'application/vnd.google-apps.document') {
      const response = await drive.files.export({
        fileId,
        mimeType: 'text/plain',
      });
      return response.data as string;
    }

    // For PDFs, download and extract text
    if (mimeType === 'application/pdf') {
      const response = await drive.files.get({
        fileId,
        alt: 'media',
      }, {
        responseType: 'arraybuffer',
      });

      const buffer = Buffer.from(response.data as ArrayBuffer);
      return await parsePdf(buffer);
    }

    // For regular files, download content
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    });
    return response.data as string;
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(fileId: string): Promise<DriveDocument | null> {
    try {
      const drive = await this.getClient();

      const fileResponse = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, webViewLink',
      });

      const file = fileResponse.data;
      if (!file.id || !file.name) {
        return null;
      }

      const content = await this.getDocumentContent(file.id, file.mimeType || '');

      return {
        id: file.id,
        name: file.name,
        content,
        mimeType: file.mimeType || '',
        modifiedTime: file.modifiedTime || new Date().toISOString(),
        webViewLink: file.webViewLink || undefined,
      };
    } catch (error) {
      console.error('Failed to get Google Drive document:', error);
      return null;
    }
  }

  /**
   * Search documents by keyword
   */
  async search(query: string): Promise<DriveDocument[]> {
    const documents = await this.listDocuments();
    const queryLower = query.toLowerCase();

    return documents.filter(doc => {
      const contentLower = (doc.content || '').toLowerCase();
      const nameLower = (doc.name || '').toLowerCase();
      return contentLower.includes(queryLower) || nameLower.includes(queryLower);
    });
  }

  /**
   * Search with snippets (similar to local source)
   */
  async searchWithSnippets(
    query: string,
    maxSnippetLength: number = 300
  ): Promise<Array<{ document: DriveDocument; snippet: string; relevance: number }>> {
    const documents = await this.listDocuments();
    const queryTerms = this.extractSearchTerms(query.toLowerCase());

    const results = documents.map(doc => {
      const contentLower = (doc.content || '').toLowerCase();
      const nameLower = (doc.name || '').toLowerCase();

      let relevance = 0;
      queryTerms.forEach(term => {
        if (contentLower.includes(term)) {
          const matches = contentLower.split(term).length - 1;
          relevance += matches * 2;
        }
        if (nameLower.includes(term)) {
          relevance += 5;
        }
      });

      let snippet = '';
      if (relevance > 0) {
        let firstMatchIndex = doc.content.length;
        queryTerms.forEach(term => {
          const index = contentLower.indexOf(term);
          if (index !== -1 && index < firstMatchIndex) {
            firstMatchIndex = index;
          }
        });

        if (firstMatchIndex === doc.content.length) {
          firstMatchIndex = 0;
        }

        const start = Math.max(0, firstMatchIndex - 50);
        const end = Math.min(doc.content.length, firstMatchIndex + maxSnippetLength - 50);
        snippet = doc.content.substring(start, end);

        if (start > 0) snippet = '...' + snippet;
        if (end < doc.content.length) snippet = snippet + '...';
      }

      return { document: doc, snippet, relevance };
    });

    return results
      .filter(r => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Extract search terms from query
   */
  private extractSearchTerms(query: string): string[] {
    const stopWords = [
      'の', 'に', 'を', 'は', 'が', 'で', 'と', 'から', 'まで', 'より',
      'について', 'ください', '教えて', 'とは', 'です', 'ます', 'ある',
      'する', 'いる', 'なる', 'れる', 'られる', 'こと', 'もの',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'about', 'what', 'how', 'when', 'where', 'which', 'who',
    ];

    const terms = query
      .split(/[\s、。？！?!,.\-\/\\]+/)
      .flatMap(term => term.split(/(?:の|に|を|は|が|で|と|について|ください)/))
      .map(t => t.trim())
      .filter(t => t.length >= 2 && !stopWords.includes(t));

    const cleanQuery = query.replace(/[\s、。？！?!,.]+/g, '').trim();
    if (cleanQuery.length >= 2 && !terms.includes(cleanQuery)) {
      terms.push(cleanQuery);
    }

    return Array.from(new Set(terms));
  }
}

// Singleton instance
let driveSource: GoogleDriveSource | null = null;

export function getGoogleDriveSource(): GoogleDriveSource {
  if (!driveSource) {
    driveSource = new GoogleDriveSource();
  }
  return driveSource;
}
