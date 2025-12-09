import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getVertexGeminiClient } from '@/lib/gemini/vertex-client';
import { getVertexSearchClient, SearchResult } from '@/lib/google/vertex-search';
import { getGoogleDriveClient } from '@/lib/google/drive';
import { getLocalDocumentSource } from '@/lib/documents/local-source';
import { getGoogleDriveSource } from '@/lib/documents/google-drive-source';
import { InterpretationService, InterpretationRule } from '@/lib/interpretation';

export const runtime = 'nodejs';

interface ChatRequest {
  message: string;
  sessionId: string;
}

interface Source {
  documentId: string;
  fileName: string;
  relevantContent: string;
  driveUrl?: string;  // Direct Google Drive URL
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, sessionId } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Message and sessionId are required' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('qa_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Save user message
    const { data: userMessage, error: userMsgError } = await supabase
      .from('qa_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Get relevant documents from knowledge base
    const sources = await searchDocuments(supabase, message);

    // Build context from sources
    const context = sources.length > 0
      ? sources.map(s => `[${s.fileName}]\n${s.relevantContent}`).join('\n\n---\n\n')
      : '';

    // Get interpretation rules for the documents (Interpretation Layer)
    const interpretationService = new InterpretationService(supabase);
    let appliedRules: InterpretationRule[] = [];

    // Collect rules from all source documents
    for (const source of sources) {
      if (source.documentId) {
        try {
          const rules = await interpretationService.getApplicableRules(
            source.documentId,
            message
          );
          appliedRules = [...appliedRules, ...rules];
        } catch (ruleError) {
          // Failsafe: Continue without rules if fetch fails
          console.warn('Failed to fetch interpretation rules:', ruleError);
        }
      }
    }

    // Remove duplicate rules (same rule might apply to multiple docs)
    const uniqueRules = appliedRules.filter(
      (rule, index, self) => index === self.findIndex(r => r.id === rule.id)
    );

    // Generate response with Gemini via Vertex AI
    const gemini = getVertexGeminiClient();
    const systemPrompt = buildSystemPrompt(context, uniqueRules);
    const fullPrompt = `${systemPrompt}\n\nUser Question: ${message}`;

    const response = await gemini.generateContent({
      prompt: fullPrompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    // Save assistant message
    const { data: assistantMessage, error: assistantMsgError } = await supabase
      .from('qa_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: response,
        sources: sources.length > 0 ? sources : null,
      })
      .select()
      .single();

    // Record interpretation rule application (for tracking and score updates)
    if (assistantMessage && uniqueRules.length > 0) {
      const primaryDocumentId = sources[0]?.documentId || 'unknown';
      await interpretationService.recordApplication(
        assistantMessage.id,
        primaryDocumentId,
        uniqueRules.map(r => r.id)
      );
    }

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', assistantMsgError);
      return NextResponse.json(
        { error: 'Failed to save response' },
        { status: 500 }
      );
    }

    // Update session title if this is the first message
    const { count } = await supabase
      .from('qa_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (count === 2) {
      // First Q&A pair, generate title
      const titlePrompt = `Generate a short title (max 50 chars) for a conversation that starts with: "${message}". Return only the title, no quotes.`;
      const title = await gemini.generateContent({
        prompt: titlePrompt,
        temperature: 0.5,
        maxOutputTokens: 100,
      });

      await supabase
        .from('qa_sessions')
        .update({ title: title.slice(0, 50) })
        .eq('id', sessionId);
    }

    return NextResponse.json({
      message: assistantMessage,
      sources,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(context: string, interpretationRules: InterpretationRule[] = []): string {
  const basePrompt = `あなたは社内QAアシスタントです。ナレッジベースの情報に基づいて、質問に回答してください。

## 回答ルール（必須）

1. **具体的な内容を回答する**:
   - ❌ NG: 「以下の項目があります：1. プロジェクト設計 2. 戦略設計...」
   - ✅ OK: 「プロジェクト設計では、○○を確認し、△△を実施する必要があります。具体的には...」

2. **「詳細は〜を参照」は禁止**:
   - ❌ NG: 「詳細はガイドラインを参照してください」
   - ✅ OK: ガイドラインの内容をそのまま説明する

3. **チェックリスト・基準・手順は具体的に**:
   - 箇条書きで具体的な項目を列挙
   - 数値基準があれば明記
   - 実際のアクションや確認事項を記載

4. **質問が広範囲の場合**:
   - 主要なポイントを3-5個に絞って具体的に説明
   - それぞれの項目について実践的なアドバイスを含める

5. **回答フォーマット**:
   - 見出しと箇条書きを使って読みやすく構造化
   - 重要なポイントは太字で強調
   - 具体例や数値を含める`;

  // Build interpretation guide section if rules exist
  let interpretationGuide = '';
  if (interpretationRules.length > 0) {
    const rulesByType: Record<string, InterpretationRule[]> = {
      CONTEXT: [],
      CLARIFICATION: [],
      FORMAT: [],
      MISUNDERSTANDING: [],
      RELATED: [],
    };

    for (const rule of interpretationRules) {
      rulesByType[rule.rule_type].push(rule);
    }

    const sections: string[] = [];

    if (rulesByType.CONTEXT.length > 0) {
      sections.push(`### 補足情報・前提条件
${rulesByType.CONTEXT.map(r => `- ${r.content}`).join('\n')}`);
    }

    if (rulesByType.CLARIFICATION.length > 0) {
      sections.push(`### 曖昧な表現の解釈
${rulesByType.CLARIFICATION.map(r => `- ${r.content}`).join('\n')}`);
    }

    if (rulesByType.MISUNDERSTANDING.length > 0) {
      sections.push(`### よくある誤解（注意）
${rulesByType.MISUNDERSTANDING.map(r => `- ${r.content}`).join('\n')}`);
    }

    if (rulesByType.FORMAT.length > 0) {
      sections.push(`### 回答形式のガイド
${rulesByType.FORMAT.map(r => `- ${r.content}`).join('\n')}`);
    }

    if (rulesByType.RELATED.length > 0) {
      sections.push(`### 関連情報
${rulesByType.RELATED.map(r => `- ${r.content}`).join('\n')}`);
    }

    if (sections.length > 0) {
      interpretationGuide = `

## 解釈ガイド（回答時に考慮してください）

${sections.join('\n\n')}`;
    }
  }

  if (context) {
    return `${basePrompt}

---

## ナレッジベースの情報

${context}${interpretationGuide}

---

上記の情報を使って、ユーザーの質問に**具体的に**回答してください。
項目名だけでなく、その中身・詳細・実際のチェック項目を説明することが重要です。
解釈ガイドがある場合は、それを考慮して回答してください。`;
  }

  return `${basePrompt}

---

Note: ナレッジベースに関連ドキュメントが見つかりませんでした。一般的なガイダンスを提供しますが、詳細は担当部署にお問い合わせください。`;
}

async function searchDocuments(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  query: string
): Promise<Source[]> {
  // Check if Vertex AI Search is configured
  const dataStoreId = process.env.VERTEX_DATASTORE_ID;
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!dataStoreId) {
    // If Google Drive folder is configured, use it
    if (driveFolderId) {
      console.log('Using Google Drive documents for search');
      return searchGoogleDriveDocuments(query);
    }
    console.log('VERTEX_DATASTORE_ID not set, using local documents');
    return searchLocalDocuments(query);
  }

  try {
    // Use Vertex AI Search for semantic document retrieval
    const searchClient = getVertexSearchClient();
    const driveClient = getGoogleDriveClient();

    // Search using Vertex AI Agent Builder
    const searchResults = await searchClient.search(query, { pageSize: 5 });

    if (searchResults.length === 0) {
      console.log('No search results from Vertex AI Search');
      return [];
    }

    // Convert search results to Source format
    const sources: Source[] = await Promise.all(
      searchResults.map(async (result: SearchResult) => {
        let content = result.snippet;
        let driveUrl = result.link;  // Use the link from Vertex AI Search

        // If we have a document ID that matches a Drive file, get more content
        if (result.documentId) {
          try {
            // Check if this document is in our database
            const { data: doc } = await supabase
              .from('qa_documents')
              .select('file_name, drive_file_id')
              .eq('drive_file_id', result.documentId)
              .single();

            if (doc) {
              // Get full content from Drive for better context
              const fullContent = await driveClient.getFileContent(result.documentId);
              // Extract relevant portion (first 2000 chars for context)
              content = fullContent.slice(0, 2000);

              // Build Drive URL from file ID if not already set
              if (!driveUrl && doc.drive_file_id) {
                driveUrl = `https://drive.google.com/file/d/${doc.drive_file_id}/view`;
              }

              return {
                documentId: result.documentId,
                fileName: doc.file_name,
                relevantContent: content,
                driveUrl,
              };
            }
          } catch (driveError) {
            console.warn(`Could not fetch Drive content for ${result.documentId}:`, driveError);
          }
        }

        // Fallback to search result snippet
        return {
          documentId: result.documentId,
          fileName: result.title || 'Unknown Document',
          relevantContent: content,
          driveUrl,
        };
      })
    );

    // Update document access tracking in database
    for (const source of sources) {
      if (source.documentId) {
        await supabase
          .from('qa_documents')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('drive_file_id', source.documentId);
      }
    }

    return sources.filter(s => s.relevantContent);
  } catch (error) {
    console.error('Search documents error:', error);

    // Fallback to basic database search if Vertex AI Search fails
    return fallbackDatabaseSearch(supabase, query);
  }
}

async function fallbackDatabaseSearch(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  query: string
): Promise<Source[]> {
  // Fallback: Basic keyword search in document names
  const { data: documents, error } = await supabase
    .from('qa_documents')
    .select('id, file_name, drive_file_id, content_hash')
    .textSearch('file_name', query, { type: 'websearch' })
    .limit(5);

  if (error || !documents || documents.length === 0) {
    // Try simpler ILIKE search
    const { data: ilikeDocs } = await supabase
      .from('qa_documents')
      .select('id, file_name, drive_file_id')
      .ilike('file_name', `%${query.split(' ')[0]}%`)
      .limit(5);

    if (!ilikeDocs || ilikeDocs.length === 0) {
      // Final fallback: Search local documents
      return searchLocalDocuments(query);
    }

    return ilikeDocs.map(doc => ({
      documentId: doc.drive_file_id,
      fileName: doc.file_name,
      relevantContent: `Document: ${doc.file_name}`,
    }));
  }

  return documents.map(doc => ({
    documentId: doc.drive_file_id,
    fileName: doc.file_name,
    relevantContent: `Document: ${doc.file_name}`,
  }));
}

/**
 * Search local markdown documents (development fallback)
 */
async function searchLocalDocuments(query: string): Promise<Source[]> {
  try {
    const localSource = getLocalDocumentSource();
    const results = await localSource.searchWithSnippets(query, 500);

    console.log(`Local document search found ${results.length} results for: ${query}`);

    return results.slice(0, 5).map(result => ({
      documentId: `local:${result.document.id}`,
      fileName: result.document.name,
      relevantContent: result.document.content.slice(0, 2000),
    }));
  } catch (error) {
    console.error('Local document search error:', error);
    return [];
  }
}

/**
 * Search Google Drive documents (PDF/Docs)
 */
async function searchGoogleDriveDocuments(query: string): Promise<Source[]> {
  try {
    const driveSource = getGoogleDriveSource();
    const results = await driveSource.searchWithSnippets(query, 500);

    console.log(`Google Drive search found ${results.length} results for: ${query}`);

    return results.slice(0, 5).map(result => ({
      documentId: `drive:${result.document.id}`,
      fileName: result.document.name,
      relevantContent: result.document.content.slice(0, 2000),
    }));
  } catch (error) {
    console.error('Google Drive search error:', error);
    // Fallback to local documents if Drive fails
    return searchLocalDocuments(query);
  }
}
