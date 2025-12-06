File Search Stores


File Search API は、Google のインフラストラクチャを使用して検索拡張生成（RAG）システムを構築するためのホスト型質問応答サービスを提供します。

メソッド: media.uploadToFileSearchStore
データを FileSearchStore にアップロードし、前処理とチャンク化を行ってから FileSearchStore ドキュメントに保存します。

エンドポイント
アップロード URI（メディアのアップロード リクエストの場合）:
post
https://generativelanguage.googleapis.com/upload/v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore
メタデータ URI（メタデータのみのリクエストの場合）:
post
https://generativelanguage.googleapis.com/v1beta/{fileSearchStoreName=fileSearchStores/*}:uploadToFileSearchStore
パスパラメータ
fileSearchStoreName
string
必須。変更不可。ファイルをアップロードする FileSearchStore の名前。例: fileSearchStores/my-file-search-store-123 形式は fileSearchStores/{filesearchstore} です。

リクエストの本文
リクエストの本文には、次の構造のデータが含まれます。

フィールド
displayName
string
省略可。作成されたドキュメントの表示名。

customMetadata[]
object (CustomMetadata)
データに関連付けるカスタム メタデータ。

chunkingConfig
object (ChunkingConfig)
省略可。サービスにデータのチャンク方法を指示する構成。指定しない場合、サービスはデフォルトのパラメータを使用します。

mimeType
string
省略可。データの MIME タイプ。指定されていない場合は、アップロードされたコンテンツから推測されます。

レスポンスの本文
これは google.longrunning.Operation のコピーです。scotty とやり取りするには、最上位の Operation proto に追加できない scotty 固有のフィールドを追加する必要があるため、コピーする必要があります。

成功した場合、レスポンスの本文には次の構造のデータが含まれます。

フィールド
name
string
サーバーによって割り当てられる名前。最初にその名前を返すサービスと同じサービス内でのみ一意になります。デフォルトの HTTP マッピングを使用している場合は、name を operations/{unique_id} で終わるリソース名にします。

metadata
object
オペレーションに関連付けられているサービス固有のメタデータ。通常は進捗情報や、作成日時などの共通メタデータが含まれます。一部のサービスでは、このようなメタデータが提供されないこともあります。メタデータがある場合、長時間実行オペレーションを返すメソッドでは、メタデータの型をドキュメント化しておく必要があります。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

done
boolean
値が false の場合は、オペレーションが進行中であることを意味します。true の場合、オペレーションは完了しており、error または response が利用可能です。

result
Union type
オペレーションの結果。error または有効な response になります。done == false の場合、error も response も設定されません。done == true の場合、error または response のどちらか一つだけが設定されます。一部のサービスでは結果が返されない場合があります。result は次のいずれかになります。
error
object (Status)
失敗またはキャンセルされた場合のオペレーションのエラー結果。

response
object
オペレーションの通常の成功レスポンス。元のメソッドで成功時にデータが返されない場合（Delete など）、レスポンスは google.protobuf.Empty になります。元のメソッドが標準の Get/Create/Update である場合、レスポンスはリソースになります。他のメソッドについては、レスポンスの型が XxxResponse（Xxx は元のメソッド名）になります。たとえば、元のメソッド名が TakeSnapshot() であれば、レスポンスの型は TakeSnapshotResponse になると推測できます。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

JSON 表現

{
  "name": string,
  "metadata": {
    "@type": string,
    field1: ...,
    ...
  },
  "done": boolean,

  // result
  "error": {
    object (Status)
  },
  "response": {
    "@type": string,
    field1: ...,
    ...
  }
  // Union type
}
メソッド: fileSearchStores.create
空の FileSearchStore を作成します。

エンドポイント
post
https://generativelanguage.googleapis.com/v1beta/fileSearchStores

リクエストの本文
リクエストの本文には FileSearchStore のインスタンスが含まれます。

フィールド
displayName
string
省略可。FileSearchStore の人が読める表示名。表示名は、スペースを含めて 512 文字以下にする必要があります。例: 「セマンティック リトリーバーに関するドキュメント」

レスポンスの本文
成功した場合、レスポンスの本文には、新しく作成された FileSearchStore のインスタンスが含まれます。

メソッド: fileSearchStores.delete
FileSearchStore を削除します。

エンドポイント
削除
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*}

パスパラメータ
name
string
必須。FileSearchStore のリソース名。例: fileSearchStores/my-file-search-store-123 形式は fileSearchStores/{filesearchstore} です。

クエリ パラメータ
force
boolean
省略可。true に設定すると、この FileSearchStore に関連する Document とオブジェクトも削除されます。

false（デフォルト）の場合、FileSearchStore に Document が含まれていると、FAILED_PRECONDITION エラーが返されます。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文は空の JSON オブジェクトになります。

メソッド: fileSearchStores.get
特定の FileSearchStore に関する情報を取得します。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*}

パスパラメータ
name
string
必須。FileSearchStore の名前。例: fileSearchStores/my-file-search-store-123 形式は fileSearchStores/{filesearchstore} です。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文には FileSearchStore のインスタンスが含まれます。

メソッド: fileSearchStores.list
ユーザーが所有するすべての FileSearchStores を一覧表示します。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/fileSearchStores

クエリ パラメータ
pageSize
integer
省略可。返す FileSearchStores の最大数（ページごと）。サービスが返す FileSearchStores は、これより少ない場合があります。

指定されていない場合、最大で 10 個の FileSearchStores が返されます。最大サイズの上限は 1 ページあたり 20 FileSearchStores です。

pageToken
string
省略可。前回の fileSearchStores.list 呼び出しから受け取ったページトークン。

次のページを取得するには、レスポンスで返された nextPageToken を次のリクエストの引数として指定します。

ページ分割を行う場合、fileSearchStores.list に指定する他のすべてのパラメータは、ページトークンを提供した呼び出しと一致する必要があります。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
FileSearchStores のページ分割されたリストを含む fileSearchStores.list からのレスポンス。結果は fileSearchStore.create_time の昇順で並べ替えられます。

成功した場合、レスポンスの本文には次の構造のデータが含まれます。

フィールド
fileSearchStores[]
object (FileSearchStore)
返された ragStores。

nextPageToken
string
次のページを取得するために pageToken として送信できるトークン。このフィールドを省略すると、それ以上ページは取得されません。

JSON 表現

{
  "fileSearchStores": [
    {
      object (FileSearchStore)
    }
  ],
  "nextPageToken": string
}
メソッド: fileSearchStores.importFile
ファイル サービスから FileSearchStore に File をインポートします。

エンドポイント
post
https://generativelanguage.googleapis.com/v1beta/{fileSearchStoreName=fileSearchStores/*}:importFile

パスパラメータ
fileSearchStoreName
string
必須。変更不可。ファイルをインポートする FileSearchStore の名前。例: fileSearchStores/my-file-search-store-123 形式は fileSearchStores/{filesearchstore} です。

リクエストの本文
リクエストの本文には、次の構造のデータが含まれます。

フィールド
fileName
string
必須。インポートする File の名前。例: files/abc-123

customMetadata[]
object (CustomMetadata)
ファイルに関連付けるカスタム メタデータ。

chunkingConfig
object (ChunkingConfig)
省略可。サービスにファイルのチャンク方法を指示する構成。指定しない場合、サービスはデフォルトのパラメータを使用します。

レスポンスの本文
成功した場合、レスポンスの本文には Operation のインスタンスが含まれます。

REST リソース: fileSearchStores.operations
リソース: Operation
このリソースは、ネットワーク API 呼び出しの結果である長時間実行オペレーションを表します。

フィールド
name
string
サーバーによって割り当てられる名前。最初にその名前を返すサービスと同じサービス内でのみ一意になります。デフォルトの HTTP マッピングを使用している場合は、name を operations/{unique_id} で終わるリソース名にします。

metadata
object
オペレーションに関連付けられているサービス固有のメタデータ。通常は進捗情報や、作成日時などの共通メタデータが含まれます。一部のサービスでは、このようなメタデータが提供されないこともあります。メタデータがある場合、長時間実行オペレーションを返すメソッドでは、メタデータの型をドキュメント化しておく必要があります。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

done
boolean
値が false の場合は、オペレーションが進行中であることを意味します。true の場合、オペレーションは完了しており、error または response が利用可能です。

result
Union type
オペレーションの結果。error または有効な response になります。done == false の場合、error も response も設定されません。done == true の場合、error または response のどちらか一つだけが設定されます。一部のサービスでは結果が返されない場合があります。result は次のいずれかになります。
error
object (Status)
失敗またはキャンセルされた場合のオペレーションのエラー結果。

response
object
オペレーションの通常の成功レスポンス。元のメソッドで成功時にデータが返されない場合（Delete など）、レスポンスは google.protobuf.Empty になります。元のメソッドが標準の Get/Create/Update である場合、レスポンスはリソースになります。他のメソッドについては、レスポンスの型が XxxResponse（Xxx は元のメソッド名）になります。たとえば、元のメソッド名が TakeSnapshot() であれば、レスポンスの型は TakeSnapshotResponse になると推測できます。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

JSON 表現

{
  "name": string,
  "metadata": {
    "@type": string,
    field1: ...,
    ...
  },
  "done": boolean,

  // result
  "error": {
    object (Status)
  },
  "response": {
    "@type": string,
    field1: ...,
    ...
  }
  // Union type
}
メソッド: fileSearchStores.operations.get
長時間実行オペレーションの最新状態を取得します。クライアントはこのメソッドを使用して、API サービスで推奨される間隔でオペレーションの結果をポーリングできます。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/operations/*}

パスパラメータ
name
string
オペレーション リソースの名前。形式は fileSearchStores/{filesearchstore}/operations/{operation} です。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文には Operation のインスタンスが含まれます。

REST リソース: fileSearchStores.upload.operations
リソース: Operation
このリソースは、ネットワーク API 呼び出しの結果である長時間実行オペレーションを表します。

フィールド
name
string
サーバーによって割り当てられる名前。最初にその名前を返すサービスと同じサービス内でのみ一意になります。デフォルトの HTTP マッピングを使用している場合は、name を operations/{unique_id} で終わるリソース名にします。

metadata
object
オペレーションに関連付けられているサービス固有のメタデータ。通常は進捗情報や、作成日時などの共通メタデータが含まれます。一部のサービスでは、このようなメタデータが提供されないこともあります。メタデータがある場合、長時間実行オペレーションを返すメソッドでは、メタデータの型をドキュメント化しておく必要があります。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

done
boolean
値が false の場合は、オペレーションが進行中であることを意味します。true の場合、オペレーションは完了しており、error または response が利用可能です。

result
Union type
オペレーションの結果。error または有効な response になります。done == false の場合、error も response も設定されません。done == true の場合、error または response のどちらか一つだけが設定されます。一部のサービスでは結果が返されない場合があります。result は次のいずれかになります。
error
object (Status)
失敗またはキャンセルされた場合のオペレーションのエラー結果。

response
object
オペレーションの通常の成功レスポンス。元のメソッドで成功時にデータが返されない場合（Delete など）、レスポンスは google.protobuf.Empty になります。元のメソッドが標準の Get/Create/Update である場合、レスポンスはリソースになります。他のメソッドについては、レスポンスの型が XxxResponse（Xxx は元のメソッド名）になります。たとえば、元のメソッド名が TakeSnapshot() であれば、レスポンスの型は TakeSnapshotResponse になると推測できます。

任意の型のフィールドを含むオブジェクト。追加フィールドの "@type" には、その型を識別する URI が含まれます。例: { "id": 1234, "@type": "types.example.com/standard/id" }

JSON 表現

{
  "name": string,
  "metadata": {
    "@type": string,
    field1: ...,
    ...
  },
  "done": boolean,

  // result
  "error": {
    object (Status)
  },
  "response": {
    "@type": string,
    field1: ...,
    ...
  }
  // Union type
}
メソッド: fileSearchStores.upload.operations.get
長時間実行オペレーションの最新状態を取得します。クライアントはこのメソッドを使用して、API サービスで推奨される間隔でオペレーションの結果をポーリングできます。

エンドポイント
get
https://generativelanguage.googleapis.com/v1beta/{name=fileSearchStores/*/upload/operations/*}

パスパラメータ
name
string
オペレーション リソースの名前。形式は fileSearchStores/{filesearchstore}/upload/operations/{operation} です。

リクエストの本文
リクエストの本文は空にする必要があります。

レスポンスの本文
成功した場合、レスポンスの本文には Operation のインスタンスが含まれます。

REST リソース: fileSearchStores
リソース: FileSearchStore
FileSearchStore は Document のコレクションです。

フィールド
name
string
出力専用。変更不可。ID。FileSearchStore リソース名。これは、小文字の英数字またはダッシュ（-）で構成される最大 40 文字の ID（「fileSearchStores/」接頭辞を除く名前）です。出力専用です。一意の名前は、displayName と 12 文字のランダムな接尾辞から派生します。例: fileSearchStores/my-awesome-file-search-store-123a456b789c。displayName が指定されていない場合、名前はランダムに生成されます。

displayName
string
省略可。FileSearchStore の人が読める表示名。表示名は、スペースを含めて 512 文字以下にする必要があります。例: 「セマンティック リトリーバーに関するドキュメント」

createTime
string (Timestamp format)
出力専用。FileSearchStore が作成されたときのタイムスタンプ。

RFC 3339 を使用します。生成された出力は常に Z 正規化され、小数点以下は 0、3、6、または 9 桁になります。「Z」以外のオフセットも使用できます。例: "2014-10-02T15:01:23Z"、"2014-10-02T15:01:23.045123456Z"、"2014-10-02T15:01:23+05:30"。

updateTime
string (Timestamp format)
出力専用。FileSearchStore が最後に更新されたときのタイムスタンプ。

RFC 3339 を使用します。生成された出力は常に Z 正規化され、小数点以下は 0、3、6、または 9 桁になります。「Z」以外のオフセットも使用できます。例: "2014-10-02T15:01:23Z"、"2014-10-02T15:01:23.045123456Z"、"2014-10-02T15:01:23+05:30"。

activeDocumentsCount
string (int64 format)
出力専用。FileSearchStore 内でアクティブであり、取得の準備ができているドキュメントの数。

pendingDocumentsCount
string (int64 format)
出力専用。処理中の FileSearchStore 内のドキュメントの数。

failedDocumentsCount
string (int64 format)
出力専用。処理に失敗した FileSearchStore 内のドキュメントの数。

sizeBytes
string (int64 format)
出力専用。FileSearchStore に取り込まれた未加工バイトのサイズ。これは、FileSearchStore 内のすべてのドキュメントの合計サイズです。

JSON 表現

{
  "name": string,
  "displayName": string,
  "createTime": string,
  "updateTime": string,
  "activeDocumentsCount": string,
  "pendingDocumentsCount": string,
  "failedDocumentsCount": string,
  "sizeBytes": string
}
