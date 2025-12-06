File Search API は、未加工のソースファイルまたはドキュメントを一時的な File オブジェクトとして参照します。

メソッド: fileSearchStores.documents.delete
Document を削除します。

エンドポイント
削除
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}

パスパラメータ
name
string
必須。削除する Document のリソース名。例: fileSearchStores/my-file-search-store-123/documents/the-doc-abc 形式は fileSearchStores/{filesearchstore}/documents/{document} です。

クエリ パラメータ
force
boolean
省略可。true に設定すると、この Document に関連する Chunk とオブジェクトも削除されます。

false（デフォルト）の場合、Document に Chunk が含まれていると、FAILED_PRECONDITION エラーが返されます。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文は空の JSON オブジェクトになります。

メソッド: fileSearchStores.documents.get
特定の Document に関する情報を取得します。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}

パスパラメータ
name
string
必須。取得する Document の名前。例: fileSearchStores/my-file-search-store-123/documents/the-doc-abc 形式は fileSearchStores/{filesearchstore}/documents/{document} です。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文には Document のインスタンスが含まれます。

メソッド: fileSearchStores.documents.list
Corpus 内のすべての Document を一覧表示します。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/{parent=fileSearchStores/*}/documents

パスパラメータ
parent
string
必須。Document を含む FileSearchStore の名前。例: fileSearchStores/my-file-search-store-123 形式は fileSearchStores/{filesearchstore} です。

クエリ パラメータ
pageSize
integer
省略可。返す Document の最大数（ページごと）。サービスが返す Document の数は、これより少ない場合があります。

指定されていない場合は、最大で 10 個の Document が返されます。最大サイズの上限は 1 ページあたり 20 Document です。

pageToken
string
省略可。前回の documents.list 呼び出しから受け取ったページトークン。

次のページを取得するには、レスポンスで返された nextPageToken を次のリクエストの引数として指定します。

ページ分割を行う場合、documents.list に指定する他のすべてのパラメータは、ページトークンを提供した呼び出しと一致する必要があります。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
Document のページ分割されたリストを含む documents.list からのレスポンス。Document は document.create_time の昇順で並べ替えられます。

成功した場合、レスポンスの本文には次の構造のデータが含まれます。

フィールド
documents[]
object (Document)
返される Document。

nextPageToken
string
次のページを取得するために pageToken として送信できるトークン。このフィールドを省略すると、それ以上ページは取得されません。

JSON 表現

{
  "documents": [
    {
      object (Document)
    }
  ],
  "nextPageToken": string
}
メソッド: fileSearchStores.documents.query
Document に対してセマンティック検索を実行します。

エンドポイント
post
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/documents/*}:query

パスパラメータ
name
string
必須。クエリする Document の名前。例: fileSearchStores/my-file-search-store-123/documents/the-doc-abc 形式は fileSearchStores/{filesearchstore}/documents/{document} です。

リクエストの本文
リクエストの本文には、次の構造のデータが含まれます。

フィールド
query
string
必須。セマンティック検索を実行するクエリ文字列。

resultsCount
integer
省略可。返す Chunk の最大数。サービスが返す Chunk の数は、これより少ない場合があります。

指定されていない場合は、最大で 10 個の Chunk が返されます。指定できる結果の最大数は 100 です。

metadataFilters[]
object (MetadataFilter)
省略可。Chunk メタデータのフィルタ。各 MetadataFilter オブジェクトは一意のキーに対応している必要があります。複数の MetadataFilter オブジェクトは論理「AND」で結合されます。

注: Document 名がすでに指定されているため、このリクエストでは Document レベルのフィルタリングはサポートされていません。

クエリの例: (year >= 2020 OR year < 2010) AND (genre = drama OR genre = action)

MetadataFilter object list: metadataFilters = [ {key = "chunk.custom_metadata.year" conditions = [{int_value = 2020, operation = GREATER_EQUAL}, {int_value = 2010, operation = LESS}}, {key = "chunk.custom_metadata.genre" conditions = [{stringValue = "drama", operation = EQUAL}, {stringValue = "action", operation = EQUAL}}]

数値の範囲のクエリの例: （year > 2015 AND year <= 2020）

MetadataFilter object list: metadataFilters = [ {key = "chunk.custom_metadata.year" conditions = [{int_value = 2015, operation = GREATER}]}, {key = "chunk.custom_metadata.year" conditions = [{int_value = 2020, operation = LESS_EQUAL}]}]

注: 同じキーの「AND」は数値でのみサポートされます。文字列値は、同じキーの「OR」のみをサポートします。

レスポンスの本文
関連するチャンクのリストを含む documents.query からのレスポンス。

成功した場合、レスポンスの本文には次の構造のデータが含まれます。

フィールド
relevantChunks[]
object (RelevantChunk)
返された関連するチャンク。

JSON 表現

{
  "relevantChunks": [
    {
      object (RelevantChunk)
    }
  ]
}
REST リソース: fileSearchStores.documents
リソース: Document
Document は Chunk のコレクションです。

フィールド
name
string
変更不可。ID。Document リソース名。ID（「fileSearchStores/*/documents/」接頭辞を除く名前）には、小文字の英数字またはダッシュ（-）を最大 40 文字まで使用できます。ID の先頭または末尾にダッシュを使用することはできません。作成時に名前が空の場合、displayName と 12 文字のランダムな接尾辞から一意の名前が派生します。例: fileSearchStores/{file_search_store_id}/documents/my-awesome-doc-123a456b789c

displayName
string
省略可。Document の人が読める表示名。表示名は、スペースを含めて 512 文字以下にする必要があります。例: 「セマンティック リトリーバーのドキュメント」

customMetadata[]
object (CustomMetadata)
省略可。ユーザーが指定したカスタム メタデータ。Key-Value ペアとして保存され、クエリに使用されます。Document には最大 20 個の CustomMetadata を指定できます。

updateTime
string (Timestamp format)
出力専用。Document が最後に更新されたときのタイムスタンプ。

RFC 3339 を使用します。生成された出力は常に Z 正規化され、小数点以下は 0、3、6、または 9 桁になります。「Z」以外のオフセットも使用できます。例: "2014-10-02T15:01:23Z"、"2014-10-02T15:01:23.045123456Z"、"2014-10-02T15:01:23+05:30"。

createTime
string (Timestamp format)
出力専用。Document が作成されたときのタイムスタンプ。

RFC 3339 を使用します。生成された出力は常に Z 正規化され、小数点以下は 0、3、6、または 9 桁になります。「Z」以外のオフセットも使用できます。例: "2014-10-02T15:01:23Z"、"2014-10-02T15:01:23.045123456Z"、"2014-10-02T15:01:23+05:30"。

state
enum (State)
出力専用。Document の現在の状態。

sizeBytes
string (int64 format)
出力専用。ドキュメントに取り込まれた未加工バイトのサイズ。

mimeType
string
出力専用。ドキュメントの MIME タイプ。

JSON 表現

{
  "name": string,
  "displayName": string,
  "customMetadata": [
    {
      object (CustomMetadata)
    }
  ],
  "updateTime": string,
  "createTime": string,
  "state": enum (State),
  "sizeBytes": string,
  "mimeType": string
}
州
Document のライフサイクルの状態。

列挙型
STATE_UNSPECIFIED	デフォルト値。この値は、状態が省略された場合に使用されます。
STATE_PENDING	Document の一部の Chunks が処理中（エンベディングとベクトルの保存）。
STATE_ACTIVE	Document のすべての Chunks が処理され、クエリで使用できるようになります。
STATE_FAILED	Document の一部の Chunks の処理に失敗しました。