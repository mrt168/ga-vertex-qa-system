/**
 * Local Document Source
 * Reads markdown files from local filesystem as a fallback/development option
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LocalDocument {
  id: string;
  name: string;
  content: string;
  modifiedTime: string;
}

export class LocalDocumentSource {
  private docsPath: string;

  constructor(docsPath?: string) {
    // Default to sample_docs in project root
    this.docsPath = docsPath || path.join(process.cwd(), 'sample_docs');
  }

  /**
   * List all markdown files in the documents directory
   */
  async listDocuments(): Promise<LocalDocument[]> {
    try {
      if (!fs.existsSync(this.docsPath)) {
        console.warn(`Documents path does not exist: ${this.docsPath}`);
        return [];
      }

      const files = fs.readdirSync(this.docsPath);
      const markdownFiles = files.filter(f => f.endsWith('.md'));

      return markdownFiles.map(filename => {
        const filePath = path.join(this.docsPath, filename);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');

        return {
          id: filename.replace('.md', ''),
          name: filename,
          content,
          modifiedTime: stats.mtime.toISOString(),
        };
      });
    } catch (error) {
      console.error('Failed to list local documents:', error);
      return [];
    }
  }

  /**
   * Get a specific document by ID (filename without extension)
   */
  async getDocument(id: string): Promise<LocalDocument | null> {
    try {
      const filename = id.endsWith('.md') ? id : `${id}.md`;
      const filePath = path.join(this.docsPath, filename);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');

      return {
        id: id.replace('.md', ''),
        name: filename,
        content,
        modifiedTime: stats.mtime.toISOString(),
      };
    } catch (error) {
      console.error('Failed to get local document:', error);
      return null;
    }
  }

  /**
   * Simple search through documents
   * Returns documents where content contains the query
   */
  async search(query: string): Promise<LocalDocument[]> {
    const documents = await this.listDocuments();
    const queryLower = query.toLowerCase();

    return documents.filter(doc => {
      const contentLower = doc.content.toLowerCase();
      const nameLower = doc.name.toLowerCase();
      return contentLower.includes(queryLower) || nameLower.includes(queryLower);
    });
  }

  /**
   * Get relevant snippets from documents matching the query
   * Supports Japanese text by extracting keywords and checking partial matches
   */
  async searchWithSnippets(
    query: string,
    maxSnippetLength: number = 300
  ): Promise<Array<{ document: LocalDocument; snippet: string; relevance: number }>> {
    const documents = await this.listDocuments();

    // Extract meaningful terms from query
    // For Japanese, split by common particles and get key terms
    const queryLower = query.toLowerCase();
    const queryTerms = this.extractSearchTerms(queryLower);

    const results = documents.map(doc => {
      const contentLower = doc.content.toLowerCase();
      const nameLower = doc.name.toLowerCase();

      // Calculate relevance score based on term matches
      let relevance = 0;

      // Check each query term
      queryTerms.forEach(term => {
        // Check content
        if (contentLower.includes(term)) {
          const matches = contentLower.split(term).length - 1;
          relevance += matches * 2; // Content matches are worth 2 points
        }
        // Check filename (higher weight)
        if (nameLower.includes(term)) {
          relevance += 5; // Filename matches are worth 5 points
        }
      });

      // Find best snippet containing query terms
      let snippet = '';
      if (relevance > 0) {
        // Find first occurrence of any query term
        let firstMatchIndex = doc.content.length;
        queryTerms.forEach(term => {
          const index = contentLower.indexOf(term);
          if (index !== -1 && index < firstMatchIndex) {
            firstMatchIndex = index;
          }
        });

        // If no match in content, use beginning of document
        if (firstMatchIndex === doc.content.length) {
          firstMatchIndex = 0;
        }

        // Extract snippet around the match
        const start = Math.max(0, firstMatchIndex - 50);
        const end = Math.min(doc.content.length, firstMatchIndex + maxSnippetLength - 50);
        snippet = doc.content.substring(start, end);

        // Clean up snippet boundaries
        if (start > 0) snippet = '...' + snippet;
        if (end < doc.content.length) snippet = snippet + '...';
      }

      return { document: doc, snippet, relevance };
    });

    // Sort by relevance and filter out non-matches
    return results
      .filter(r => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Extract meaningful search terms from a query
   * Handles both English and Japanese text
   */
  private extractSearchTerms(query: string): string[] {
    // Japanese particles and common words to filter out
    const stopWords = [
      'の', 'に', 'を', 'は', 'が', 'で', 'と', 'から', 'まで', 'より',
      'について', 'ください', '教えて', 'とは', 'です', 'ます', 'ある',
      'する', 'いる', 'なる', 'れる', 'られる', 'こと', 'もの',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'about', 'what', 'how', 'when', 'where', 'which', 'who',
    ];

    // Split by common delimiters and Japanese particles
    const terms = query
      .split(/[\s、。？！?!,.\-\/\\]+/)
      .flatMap(term => {
        // For Japanese text, try to extract meaningful chunks
        // Split on common particle patterns
        return term.split(/(?:の|に|を|は|が|で|と|について|ください)/);
      })
      .map(t => t.trim())
      .filter(t => t.length >= 2 && !stopWords.includes(t));

    // Add the original query as a term as well (for exact phrase matching)
    const cleanQuery = query.replace(/[\s、。？！?!,.]+/g, '').trim();
    if (cleanQuery.length >= 2 && !terms.includes(cleanQuery)) {
      terms.push(cleanQuery);
    }

    // Extract key Japanese nouns (rough heuristic: longer segments)
    const uniqueTerms = Array.from(new Set(terms));

    return uniqueTerms;
  }
}

// Singleton instance
let localSource: LocalDocumentSource | null = null;

export function getLocalDocumentSource(): LocalDocumentSource {
  if (!localSource) {
    localSource = new LocalDocumentSource();
  }
  return localSource;
}
