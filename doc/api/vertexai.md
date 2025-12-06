Vertex AI (Gemini API) を Node.js (JavaScript) から利用するための実装ガイドです。
主に、最新の **Generative AI SDK (`@google-cloud/vertexai`)** を使用する方法を記載しています。

---

# Vertex AI SDK for Node.js 実装ガイド

このガイドでは、Google Cloud の Vertex AI 上で **Gemini 1.5 Pro / Flash** を Node.js アプリケーションから呼び出す方法を解説します。

## 1. 事前準備

### 1.1 Google Cloud プロジェクトの設定

1. Google Cloud Console でプロジェクトを作成。
2. **Vertex AI API** を有効化 (`aiplatform.googleapis.com`)。

### 1.2 ライブラリのインストール

プロジェクトのディレクトリで以下のコマンドを実行し、公式SDKをインストールします。

```bash
npm install @google-cloud/vertexai
```

### 1.3 認証設定 (ローカル開発時)

ローカル環境で実行する場合は、`gcloud` CLIを使って認証を通すのが一番簡単です。

```bash
gcloud auth application-default login
```

※ サーバー(Cloud Run等)で動かす場合は、適切な権限を持つサービスアカウントを割り当てれば自動で認証されます。

---

## 2. 基本的なテキスト生成 (Text Generation)

Gemini にプロンプトを投げて回答を得る基本的なコードです。

```javascript
const { VertexAI } = require('@google-cloud/vertexai');

// 初期設定
const project = 'your-project-id'; // 自分のプロジェクトID
const location = 'asia-northeast1'; // 東京リージョン (または us-central1)

async function generateText() {
  // Vertex AI クライアントの初期化
  const vertexAI = new VertexAI({ project: project, location: location });

  // モデルの選択 (gemini-1.5-pro や gemini-1.5-flash)
  const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
  });

  const prompt = '遺伝的アルゴリズムについて、小学生でもわかるように説明してください。';

  try {
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const text = response.candidates[0].content.parts[0].text;
  
    console.log('--- 回答 ---');
    console.log(text);
  } catch (error) {
    console.error('Error:', error);
  }
}

generateText();
```

---

## 3. ストリーミング生成 (Streaming)

回答を少しずつ受け取って表示する方法です。チャットUIなどで待ち時間を減らすために必須です。

```javascript
async function generateStream() {
  const vertexAI = new VertexAI({ project: 'your-project-id', location: 'asia-northeast1' });
  const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = '日本の四季の素晴らしさを長文で語ってください。';

  const streamingResp = await generativeModel.generateContentStream(prompt);

  process.stdout.write('--- ストリーミング回答開始 ---\n');
  
  // チャンク（塊）ごとに処理
  for await (const item of streamingResp.stream) {
    if (item.candidates && item.candidates[0].content.parts[0].text) {
      process.stdout.write(item.candidates[0].content.parts[0].text);
    }
  }
  
  process.stdout.write('\n--- 終了 ---\n');
}
```

---

## 4. マルチターンチャット (Chat Session)

文脈（会話履歴）を保持しながら対話を行う方法です。

```javascript
async function startChatSession() {
  const vertexAI = new VertexAI({ project: 'your-project-id', location: 'asia-northeast1' });
  const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  // チャットセッションの開始
  const chat = generativeModel.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: 'あなたは優秀な社内SEです。' }],
      },
      {
        role: 'model',
        parts: [{ text: '承知しました。社内システムに関する質問になんでもお答えします。' }],
      },
    ],
  });

  // 1つ目の質問
  const msg1 = '社内ポータルにログインできません。';
  const result1 = await chat.sendMessage(msg1);
  console.log('User:', msg1);
  console.log('AI:', result1.response.candidates[0].content.parts[0].text);

  // 2つ目の質問（文脈を引き継ぐ）
  const msg2 = 'パスワードを忘れた場合はどうすればいい？';
  const result2 = await chat.sendMessage(msg2);
  console.log('User:', msg2);
  console.log('AI:', result2.response.candidates[0].content.parts[0].text);
}
```

---

## 5. [応用] JSONモードでの出力

システム連携のために、確実にJSON形式で出力させたい場合の設定です。

```javascript
async function generateJson() {
  const vertexAI = new VertexAI({ project: 'your-project-id', location: 'asia-northeast1' });
  
  const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    // 生成設定 (Generation Config)
    generationConfig: {
      responseMimeType: 'application/json', // JSONモードを強制
    }
  });

  const prompt = `
    以下の情報をJSON形式で抽出してください。
    キーは "name", "age", "skill" とすること。
  
    テキスト:
    佐藤太郎は30歳のエンジニアで、Node.jsとPythonが得意です。
  `;

  const result = await generativeModel.generateContent(prompt);
  console.log(result.response.candidates[0].content.parts[0].text);
  // 出力例: { "name": "佐藤太郎", "age": 30, "skill": ["Node.js", "Python"] }
}
```

---

## 6. [補足] Agent Builder (Search) との連携

ご質問にあった「Google File Search API (Agent Builder / Vertex AI Search)」を呼び出す場合は、`@google-cloud/vertexai` ではなく、**`@google-cloud/discoveryengine`** という別のSDKを使用します。

### RAG検索部分の実装例

```bash
npm install @google-cloud/discoveryengine
```

```javascript
const { SearchServiceClient } = require('@google-cloud/discoveryengine').v1beta;

const projectId = 'your-project-id';
const location = 'global'; // Agent Builderは通常 global
const dataStoreId = 'your-datastore-id'; // Agent Builderで作成したデータストアID

async function searchDocuments(query) {
  const client = new SearchServiceClient();

  const servingConfig = client.projectLocationCollectionDataStoreServingConfigPath(
    projectId,
    location,
    'default_collection',
    dataStoreId,
    'default_search' // デフォルト設定ID
  );

  const request = {
    servingConfig: servingConfig,
    query: query,
    pageSize: 3, // 上位3件取得
  };

  const [response] = await client.search(request);

  // 検索結果の表示
  response.results.forEach((result, i) => {
    const data = result.document.derivedStructData;
    console.log(`Rank ${i + 1}: ${data.title}`);
    console.log(`Snippet: ${data.snippets[0].snippet}`);
    console.log('---');
  });
  
  return response.results;
}
```

### 統合（RAGシステムの実装）

1. `searchDocuments(query)` で関連ドキュメントのテキストを取得。
2. 取得したテキストをコンテキストとしてプロンプトに埋め込む。
3. `vertexAI.generateContent(prompt)` で回答を生成する。

この流れで実装します。
