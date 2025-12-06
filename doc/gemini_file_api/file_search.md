Gemini API では、ファイル検索ツールを使用して検索拡張生成（RAG）が可能です。ファイル検索では、ユーザーのプロンプトに基づいて関連情報をすばやく取得できるように、データのインポート、チャンク化、インデックス登録が行われます。この情報はモデルにコンテキストとして提供され、モデルはより正確で関連性の高い回答を提供できるようになります。

uploadToFileSearchStore API を使用すると、既存のファイルをファイル検索ストアに直接アップロードできます。また、ファイルを同時に作成する場合は、個別にアップロードしてから importFile を実行します。

ファイル検索ストアに直接アップロードする
この例では、ファイルをファイル ストアに直接アップロードする方法を示します。

Python
JavaScript
REST

FILE_PATH="path/to/sample.pdf"
MIME_TYPE=$(file -b --mime-type "${FILE_PATH}")
NUM_BYTES=$(wc -c < "${FILE_PATH}")

# Create a FileSearchStore
STORE_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "displayName": "My Store" }')

# Extract the store name (format: fileSearchStores/xxxxxxx)
STORE_NAME=$(echo $STORE_RESPONSE | jq -r '.name')

# Initiate Resumable Upload to the Store
TMP_HEADER="upload-header.tmp"

curl -s -D "${TMP_HEADER}" \ "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" > /dev/null

# Extract upload_url from headers
UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

# --- Upload the actual bytes ---
curl "${UPLOAD_URL}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}" 2> /dev/null

# Generate content using the FileSearchStore
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
            "contents": [{
                "parts":[{"text": "What does the research say about ..."}]          
            }],
            "tools": [{
                "file_search": { "file_search_store_names":["'$STORE_NAME'"] }
            }]
        }' 2> /dev/null > response.json

cat response.json
詳しくは、uploadToFileSearchStore の API リファレンスをご覧ください。

ファイルのインポート
または、既存のファイルをアップロードしてファイル ストアにインポートすることもできます。

Python
JavaScript
REST

FILE_PATH="path/to/sample.pdf"
MIME_TYPE=$(file -b --mime-type "${FILE_PATH}")
NUM_BYTES=$(wc -c < "${FILE_PATH}")

# Create a FileSearchStore
STORE_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "displayName": "My Store" }')

STORE_NAME=$(echo $STORE_RESPONSE | jq -r '.name')

# Initiate Resumable Upload to the Store
TMP_HEADER="upload-header.tmp"

curl -s -X POST "https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}" \
  -D "${TMP_HEADER}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" 2> /dev/null

UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

# Upload the actual bytes.
curl -s -X POST "${UPLOAD_URL}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}" 2> /dev/null > file_info.json

file_uri=$(jq ".file.name" file_info.json)

# Import files into the file search store
operation_name=$(curl "https://generativelanguage.googleapis.com/v1beta/${STORE_NAME}:importFile?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
        "file_name":'$file_uri'
    }' | jq -r .name)

# Wait for long running operation to complete
while true; do
  # Get the full JSON status and store it in a variable.
  status_response=$(curl -s -H "x-goog-api-key: $GEMINI_API_KEY" "https://generativelanguage.googleapis.com/v1beta/${operation_name}")

  # Check the "done" field from the JSON stored in the variable.
  is_done=$(echo "${status_response}" | jq .done)

  if [ "${is_done}" = "true" ]; then
    break
  fi
  # Wait for 10 seconds before checking again.
  sleep 10
done

# Generate content using the FileSearchStore
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
            "contents": [{
                "parts":[{"text": "What does the research say about ..."}]          
            }],
            "tools": [{
                "file_search": { "file_search_store_names":["'$STORE_NAME'"] }
            }]
        }' 2> /dev/null > response.json

cat response.json
詳しくは、importFile の API リファレンスをご覧ください。

チャンク化構成
ファイルをファイル検索ストアにインポートすると、ファイルは自動的にチャンクに分割され、埋め込み、インデックス登録され、ファイル検索ストアにアップロードされます。チャンク分割戦略をより詳細に制御する必要がある場合は、chunking_config 設定を指定して、チャンクあたりの最大トークン数と重複するトークンの最大数を設定できます。

Python
JavaScript
REST

FILE_PATH="path/to/sample.pdf"
MIME_TYPE=$(file -b --mime-type "${FILE_PATH}")
NUM_BYTES=$(wc -c < "${FILE_PATH}")

# Create a FileSearchStore
STORE_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "displayName": "My Store" }')

# Extract the store name (format: fileSearchStores/xxxxxxx)
STORE_NAME=$(echo $STORE_RESPONSE | jq -r '.name')

# Initiate Resumable Upload to the Store
TMP_HEADER="upload-header.tmp"

curl -s -D "${TMP_HEADER}" \ "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" > /dev/null
  -d '{
        "chunking_config": {
          "white_space_config": {
            "max_tokens_per_chunk": 200,
            "max_overlap_tokens": 20
          }
        }
    }'

# Extract upload_url from headers
UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

# --- Upload the actual bytes ---
curl "${UPLOAD_URL}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}" 2> /dev/null
ファイル検索ストアを使用するには、アップロードとインポートの例に示すように、ツールとして generateContent メソッドに渡します。

仕組み
ファイル検索では、セマンティック検索と呼ばれる手法を使用して、ユーザーのプロンプトに関連する情報を見つけます。従来のキーワードベースの検索とは異なり、セマンティック検索はクエリの意味とコンテキストを理解します。

ファイルをインポートすると、テキストの意味を捉えるエンベディングと呼ばれる数値表現に変換されます。これらのエンベディングは、専用のファイル検索データベースに保存されます。クエリを行うと、クエリもエンベディングに変換されます。次に、システムはファイル検索を実行して、ファイル検索ストアから最も類似した関連性の高いドキュメント チャンクを見つけます。

ファイル検索 uploadToFileSearchStore API を使用する手順は次のとおりです。

ファイル検索ストアを作成する: ファイル検索ストアには、ファイルから処理されたデータが含まれます。これは、セマンティック検索が動作するエンベディングの永続コンテナです。

ファイルをアップロードしてファイル検索ストアにインポートする: ファイルをアップロードすると同時に、結果をファイル検索ストアにインポートします。これにより、未加工ドキュメントへの参照である一時的な File オブジェクトが作成されます。このデータはチャンク化され、ファイル検索エンベディングに変換されて、インデックスが作成されます。File オブジェクトは 48 時間後に削除されますが、ファイル検索ストアにインポートされたデータは、削除するまで無期限に保存されます。

ファイル検索でクエリを実行する: 最後に、generateContent 呼び出しで FileSearch ツールを使用します。ツール構成で、検索する FileSearchStore を指す FileSearchRetrievalResource を指定します。これにより、モデルは特定のファイル検索ストアでセマンティック検索を実行し、回答のグラウンディングに関連する情報を検索します。

ファイル検索のインデックス登録とクエリのプロセス
ファイル検索のインデックス登録とクエリのプロセス
この図では、ドキュメントからエンベディング モデル（gemini-embedding-001 を使用）への点線は、uploadToFileSearchStore API（ファイル ストレージをバイパス）を表しています。それ以外の場合、Files API を使用してファイルを個別に作成してからインポートすると、インデックス登録プロセスが Documents から File storage に移動し、Embedding model に移動します。

ファイル検索ストア
ファイル検索ストアは、ドキュメント エンベディングのコンテナです。File API を介してアップロードされた未加工ファイルは 48 時間後に削除されますが、ファイル検索ストアにインポートされたデータは、手動で削除するまで無期限に保存されます。複数のファイル検索ストアを作成して、ドキュメントを整理できます。FileSearchStore API を使用すると、ファイル検索ストアの作成、一覧表示、取得、削除を行って管理できます。ファイル検索ストア名はグローバル スコープです。

ファイル検索ストアの管理方法の例を次に示します。

Python
JavaScript
REST

# Create a File Search store (including optional display_name for easier reference)
curl -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" 
    -d '{ "displayName": "My Store" }'

# List all your File Search stores
curl "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \

# Get a specific File Search store by name
curl "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/my-file_search-store-123?key=${GEMINI_API_KEY}"

# Delete a File Search store
curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/my-file_search-store-123?key=${GEMINI_API_KEY}"
ファイル ストア内のドキュメントの管理に関連するメソッドとフィールドの File Search Documents API リファレンス。

ファイルのメタデータ
カスタム メタデータをファイルに追加すると、ファイルをフィルタしたり、追加のコンテキストを提供したりするのに役立ちます。メタデータは Key-Value ペアのセットです。

Python
JavaScript
REST

FILE_PATH="path/to/sample.pdf"
MIME_TYPE=$(file -b --mime-type "${FILE_PATH}")
NUM_BYTES=$(wc -c < "${FILE_PATH}")

# Create a FileSearchStore
STORE_RESPONSE=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "displayName": "My Store" }')

# Extract the store name (format: fileSearchStores/xxxxxxx)
STORE_NAME=$(echo $STORE_RESPONSE | jq -r '.name')

# Initiate Resumable Upload to the Store
TMP_HEADER="upload-header.tmp"

curl -s -D "${TMP_HEADER}" \
  "https://generativelanguage.googleapis.com/upload/v1beta/${STORE_NAME}:uploadToFileSearchStore?key=${GEMINI_API_KEY}" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Header-Content-Type: ${MIME_TYPE}" \
  -H "Content-Type: application/json" \
  -d '{
        "custom_metadata": [
          {"key": "author", "string_value": "Robert Graves"},
          {"key": "year", "numeric_value": 1934}
        ]
    }' > /dev/null

# Extract upload_url from headers
UPLOAD_URL=$(grep -i "x-goog-upload-url: " "${TMP_HEADER}" | cut -d" " -f2 | tr -d "\r")
rm "${TMP_HEADER}"

# --- Upload the actual bytes ---
curl "${UPLOAD_URL}" \
  -H "Content-Length: ${NUM_BYTES}" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@${FILE_PATH}" 2> /dev/null
これは、ファイル検索ストアに複数のドキュメントがあり、そのサブセットのみを検索する場合に便利です。

Python
JavaScript
REST

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
    -H 'Content-Type: application/json' \
    -X POST \
    -d '{
            "contents": [{
                "parts":[{"text": "Tell me about the book I, Claudius"}]          
            }],
            "tools": [{
                "file_search": { 
                    "file_search_store_names":["'$STORE_NAME'"],
                    "metadata_filter": "author = \"Robert Graves\""
                }
            }]
        }' 2> /dev/null > response.json

cat response.json
metadata_filter のリスト フィルタ構文の実装に関するガイダンスについては、google.aip.dev/160 をご覧ください。

引用
ファイル検索を使用すると、モデルの回答に、アップロードしたドキュメントのどの部分が回答の生成に使用されたかを指定する引用が含まれることがあります。これは、ファクト チェックと検証に役立ちます。

引用情報には、レスポンスの grounding_metadata 属性からアクセスできます。

Python
JavaScript

console.log(JSON.stringify(response.candidates?.[0]?.groundingMetadata, null, 2));
サポートされているモデル
次のモデルはファイル検索をサポートしています。

gemini-2.5-pro
gemini-2.5-flash
サポートされているファイル形式
ファイル検索は、次のセクションに記載されている幅広いファイル形式をサポートしています。

アプリケーション ファイルの種類
テキスト ファイルの種類
レート上限
File Search API には、サービスの安定性を維持するため、次の制限が適用されます。

最大ファイルサイズ / ドキュメントあたりの上限: 100 MB
プロジェクト ファイル検索ストアの合計サイズ（ユーザーの階層に基づく）:
無料: 1 GB
Tier 1: 10 GB
Tier 2: 100 GB
Tier 3: 1 TB
推奨事項: 最適な取得レイテンシを確保するため、各ファイル検索ストアのサイズを 20 GB 未満に制限します。
注: ファイル検索のストアサイズの制限は、入力のサイズと、それとともに生成されて保存されるエンベディングに基づいて、バックエンドで計算されます。通常、これは入力データの約 3 倍のサイズになります。