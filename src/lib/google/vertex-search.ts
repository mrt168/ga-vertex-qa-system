import { SearchServiceClient, protos } from '@google-cloud/discoveryengine';

type ISearchRequest = protos.google.cloud.discoveryengine.v1.ISearchRequest;
type ISearchResultItem = protos.google.cloud.discoveryengine.v1.SearchResponse.ISearchResult;

export interface SearchResult {
  documentId: string;
  title: string;
  snippet: string;
  link?: string;
  relevanceScore?: number;
}

export interface SearchOptions {
  pageSize?: number;
  filter?: string;
}

export class VertexSearchClient {
  private client: SearchServiceClient;
  private projectId: string;
  private location: string;
  private dataStoreId: string;

  constructor(
    projectId?: string,
    dataStoreId?: string,
    location: string = 'global'
  ) {
    this.client = new SearchServiceClient();
    this.projectId = projectId || process.env.GCP_PROJECT_ID || '';
    this.dataStoreId = dataStoreId || process.env.VERTEX_DATASTORE_ID || '';
    this.location = location;

    if (!this.projectId || !this.dataStoreId) {
      console.warn(
        'VertexSearchClient: Missing projectId or dataStoreId. Search will not work.'
      );
    }
  }

  /**
   * Search documents using Vertex AI Search
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.projectId || !this.dataStoreId) {
      console.warn('Search skipped: Missing configuration');
      return [];
    }

    const { pageSize = 5, filter } = options;

    try {
      const servingConfig =
        this.client.projectLocationCollectionDataStoreServingConfigPath(
          this.projectId,
          this.location,
          'default_collection',
          this.dataStoreId,
          'default_search'
        );

      const request: ISearchRequest = {
        servingConfig,
        query,
        pageSize,
      };

      if (filter) {
        request.filter = filter;
      }

      // Use searchAsync for async iteration
      const searchIterable = this.client.searchAsync(request);
      const results: SearchResult[] = [];
      let count = 0;

      for await (const result of searchIterable) {
        if (count >= pageSize) break;

        const searchResultItem = result as ISearchResultItem;
        const doc = searchResultItem.document;
        if (!doc) continue;

        // Extract data from derivedStructData
        const structData = doc.derivedStructData?.fields;

        const searchResult: SearchResult = {
          documentId: doc.id || '',
          title: structData?.title?.stringValue || doc.name || '',
          snippet: '',
        };

        // Extract snippets from structData
        const snippetsField = structData?.snippets?.listValue?.values;
        if (snippetsField && snippetsField.length > 0) {
          const firstSnippet = snippetsField[0]?.structValue?.fields?.snippet?.stringValue;
          if (firstSnippet) {
            searchResult.snippet = firstSnippet;
          }
        }

        // Try extractive_answers as well
        const extractiveAnswers = structData?.extractive_answers?.listValue?.values;
        if (!searchResult.snippet && extractiveAnswers && extractiveAnswers.length > 0) {
          const content = extractiveAnswers[0]?.structValue?.fields?.content?.stringValue;
          if (content) {
            searchResult.snippet = content;
          }
        }

        // Extract link
        const link = structData?.link?.stringValue;
        if (link) {
          searchResult.link = link;
        }

        results.push(searchResult);
        count++;
      }

      return results;
    } catch (error) {
      console.error('Vertex Search failed:', error);
      throw error;
    }
  }

  /**
   * Search and get full document content
   * Combines Vertex AI Search with Google Drive content retrieval
   */
  async searchWithContent(
    query: string,
    getDriveContent: (fileId: string) => Promise<string>,
    options: SearchOptions = {}
  ): Promise<Array<SearchResult & { content: string }>> {
    const searchResults = await this.search(query, options);

    const resultsWithContent = await Promise.all(
      searchResults.map(async (result) => {
        try {
          // Assuming documentId is the Drive file ID
          const content = await getDriveContent(result.documentId);
          return { ...result, content };
        } catch (error) {
          console.error(`Failed to get content for ${result.documentId}:`, error);
          return { ...result, content: result.snippet };
        }
      })
    );

    return resultsWithContent;
  }
}

// Singleton instance
let searchClient: VertexSearchClient | null = null;

export function getVertexSearchClient(): VertexSearchClient {
  if (!searchClient) {
    searchClient = new VertexSearchClient();
  }
  return searchClient;
}
