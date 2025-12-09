/**
 * Document Content Service
 * ドキュメントコンテンツの取得・キャッシュを管理
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getGoogleDriveClient } from '@/lib/google/drive';

export interface DocumentContent {
  id: string;
  drive_file_id: string;
  content: string;
  name: string;
  cached_at?: string;
}

// In-memory cache for document content (TTL: 5 minutes)
const contentCache = new Map<string, { content: DocumentContent; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class DocumentContentService {
  private driveClient = getGoogleDriveClient();

  constructor(private supabase: SupabaseClient) {}

  /**
   * ドキュメントIDからコンテンツを取得
   */
  async getDocumentContent(documentId: string): Promise<DocumentContent | null> {
    // Check cache first
    const cached = this.getFromCache(documentId);
    if (cached) {
      return cached;
    }

    // Get document metadata from Supabase
    const { data: doc, error } = await this.supabase
      .from('qaev_documents')
      .select('id, drive_file_id, file_name')
      .eq('id', documentId)
      .single();

    if (error || !doc) {
      // Try with drive_file_id
      const { data: docByDriveId } = await this.supabase
        .from('qaev_documents')
        .select('id, drive_file_id, file_name')
        .eq('drive_file_id', documentId)
        .single();

      if (!docByDriveId) {
        console.error(`Document not found: ${documentId}`);
        return null;
      }

      return this.fetchAndCacheContent(docByDriveId);
    }

    return this.fetchAndCacheContent(doc);
  }

  /**
   * Drive File IDから直接コンテンツを取得
   */
  async getContentByDriveFileId(driveFileId: string): Promise<string | null> {
    try {
      const content = await this.driveClient.getFileContent(driveFileId);
      return content;
    } catch (error) {
      console.error(`Failed to fetch content for drive file: ${driveFileId}`, error);
      return null;
    }
  }

  /**
   * 複数ドキュメントのコンテンツを一括取得
   */
  async getMultipleDocumentContents(
    documentIds: string[]
  ): Promise<Map<string, DocumentContent>> {
    const results = new Map<string, DocumentContent>();

    // Parallel fetch with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      const promises = batch.map(id => this.getDocumentContent(id));
      const contents = await Promise.all(promises);

      for (let j = 0; j < batch.length; j++) {
        if (contents[j]) {
          results.set(batch[j], contents[j]!);
        }
      }
    }

    return results;
  }

  /**
   * キャッシュからコンテンツを取得
   */
  private getFromCache(documentId: string): DocumentContent | null {
    const cached = contentCache.get(documentId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.content;
    }
    // Remove expired cache
    if (cached) {
      contentCache.delete(documentId);
    }
    return null;
  }

  /**
   * コンテンツを取得してキャッシュに保存
   */
  private async fetchAndCacheContent(
    doc: { id: string; drive_file_id: string; file_name: string }
  ): Promise<DocumentContent | null> {
    try {
      const content = await this.driveClient.getFileContent(doc.drive_file_id);

      const documentContent: DocumentContent = {
        id: doc.id,
        drive_file_id: doc.drive_file_id,
        content,
        name: doc.file_name,
        cached_at: new Date().toISOString(),
      };

      // Save to cache
      contentCache.set(doc.id, {
        content: documentContent,
        timestamp: Date.now(),
      });

      return documentContent;
    } catch (error) {
      console.error(`Failed to fetch content for document: ${doc.id}`, error);
      return null;
    }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(documentId?: string): void {
    if (documentId) {
      contentCache.delete(documentId);
    } else {
      contentCache.clear();
    }
  }

  /**
   * キャッシュの状態を取得
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: contentCache.size,
      keys: Array.from(contentCache.keys()),
    };
  }
}

// Singleton factory
let documentContentService: DocumentContentService | null = null;

export function getDocumentContentService(
  supabase: SupabaseClient
): DocumentContentService {
  if (!documentContentService) {
    documentContentService = new DocumentContentService(supabase);
  }
  return documentContentService;
}
