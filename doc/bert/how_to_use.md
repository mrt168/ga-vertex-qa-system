BERTはGoogleが2018年に発表した自然言語処理モデルで、テキストをベクトル化（Embedding）する際によく使われます。
※もし「BELT」という非常に新しい、あるいはニッチな特定のGoogle技術が意図されている場合は、おそらく「Vertex AI」のEmbeddingモデルのことを指している可能性もあります。
ここでは、「GoogleのBERT（および現代的なVertex AI）」を使って、Next.js と Laravel でテキストをベクトル化する方法 をまとめたMarkdownファイルを作成しました。
以下がMarkdownファイルの内容です。コピーして google-vectorization-guide.md などの名前で保存してご利用ください。
code
Markdown
# Google BERT (および Vertex AI) を用いたベクトル化導入ガイド

このドキュメントでは、Googleが開発した自然言語処理モデル **BERT** (またはその後継技術) を使用して、テキストをベクトル化（Embedding）する方法を解説します。

> **注意:** 質問にある「BELT」という名称のGoogle公式技術は一般に存在しないため、文脈的に最も近い **BERT**、もしくは現在Google Cloudで提供されている最新の **Vertex AI Embeddings** と解釈して記述しています。

## 技術選定について

ベクトル化を実装するには、大きく分けて2つのアプローチがあります。

1.  **Next.js (Node.js/Browser) で実装する場合:**
    *   ライブラリ `Transformers.js` を使い、BERTモデルを直接アプリ内で動かす。
    *   メリット: 完全無料、オフラインでも動作可能（モデルロード後）。
2.  **Laravel (PHP) で実装する場合:**
    *   PHPは機械学習のライブラリが少ないため、**Google Cloud Vertex AI API** を叩くのが標準的。
    *   メリット: Googleの最新・最強のモデル（Gecko等）が使える、サーバー負荷が低い。

---

## 1. Next.js で BERT を使う方法 (Transformers.js)

Hugging Faceが提供するJavaScript版のTransformersライブラリを使用し、BERTモデル（多言語対応版）をNext.js上で動かします。

### 前提条件
*   Node.js v18以上
*   Next.js プロジェクト作成済み

### 手順

**1. ライブラリのインストール**

```bash
npm install @xenova/transformers
# または
yarn add @xenova/transformers
2. ベクトル化ユーティリティの作成
lib/embedding.ts (または .js) を作成します。
ここでは、日本語に対応した多言語モデル bert-base-multilingual-cased （またはより軽量なモデル）を使用します。
code
TypeScript
// lib/embedding.ts
import { pipeline } from '@xenova/transformers';

// シングルトンパターンでパイプラインを保持（再ロード防止）
let pipelineInstance: any = null;

async function getPipeline() {
  if (!pipelineInstance) {
    // 'feature-extraction' タスクを指定
    // モデルは初回実行時に自動的にダウンロードされます
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/bert-base-multilingual-cased');
  }
  return pipelineInstance;
}

export async function vectorizeText(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  
  // ベクトル化実行
  // pooling: 'mean' は単語ごとのベクトルを平均して文章全体のベクトルにする設定
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  
  // Tensorオブジェクトから配列に変換して返却
  return Array.from(output.data);
}
3. APIルートでの使用例
Next.jsのAPI Routes (app/api/vectorize/route.ts) で使用します。
code
TypeScript
// app/api/vectorize/route.ts
import { NextResponse } from 'next/server';
import { vectorizeText } from '@/lib/embedding';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const vector = await vectorizeText(text);

    return NextResponse.json({ 
      text, 
      vector, 
      dimension: vector.length // BERT baseの場合は通常768次元
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
2. Laravel で Google Vertex AI を使う方法
PHPでBERTを直接動かすのはパフォーマンス的に厳しいため、Google Cloud の Vertex AI API (モデル名: text-embedding-gecko など) を使用するのが現代的な「Googleのベクトル化」手法です。
前提条件
Google Cloud Platform (GCP) プロジェクトがあること。
Vertex AI API が有効化されていること。
サービスアカウントキー（JSON）を取得しているか、ADC（Application Default Credentials）が設定されていること。
手順
1. ライブラリのインストール
Google Cloud 公式のPHPクライアントを使用します。
code
Bash
composer require google/cloud-ai-platform
composer require google/auth
2. サービス作成
app/Services/GoogleEmbeddingService.php を作成します。
※注: 最新のVertex AIにはREST APIを直接叩くのが最も手軽な場合が多いです。ここではLaravelの Http クライアントを使ってREST APIを叩く例を紹介します（認証には google/auth を利用）。
code
PHP
<?php

namespace App\Services;

use Google\Auth\ApplicationDefaultCredentials;
use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use Illuminate\Support\Facades\Http;

class GoogleEmbeddingService
{
    protected string $projectId;
    protected string $location;
    protected string $modelId;

    public function __construct()
    {
        $this->projectId = config('services.google.project_id');
        $this->location = 'us-central1'; // 日本語対応モデルもここに含まれます
        $this->modelId = 'text-embedding-gecko-multilingual@latest'; // 多言語対応モデル
    }

    public function getVector(string $text): array
    {
        // 1. Google認証トークンの取得
        $scopes = ['https://www.googleapis.com/auth/cloud-platform'];
        $middleware = ApplicationDefaultCredentials::getMiddleware($scopes);
        $stack = HandlerStack::create();
        $stack->push($middleware);
        
        // Guzzleクライアント経由で認証付きリクエストを作成
        $client = new Client([
            'handler' => $stack,
            'base_uri' => 'https://us-central1-aiplatform.googleapis.com',
            'auth' => 'google_auth' 
        ]);

        $endpoint = sprintf(
            '/v1/projects/%s/locations/%s/publishers/google/models/%s:predict',
            $this->projectId,
            $this->location,
            $this->modelId
        );

        // 2. APIリクエスト
        // ※Google Authライブラリを使う場合はMiddleware経由が一般的ですが、
        // 簡易化のためLaravel HTTP Clientでトークンを使用する例も併記します。
        // ここでは raw curl 相当のロジックで説明します。
        
        // 実際の実装では `google/auth` でアクセストークンを取得して Http::withToken() するのが簡単です。
        $credentials = ApplicationDefaultCredentials::getCredentials($scopes);
        $token = $credentials->fetchAuthToken()['access_token'];

        $response = Http::withToken($token)
            ->post("https://{$this->location}-aiplatform.googleapis.com{$endpoint}", [
                'instances' => [
                    ['content' => $text]
                ],
            ]);

        if ($response->failed()) {
            throw new \Exception('Google Vertex AI Error: ' . $response->body());
        }

        $data = $response->json();

        // ベクトルデータの抽出
        return $data['predictions'][0]['embeddings']['values'];
    }
}
3. 環境変数の設定
.env ファイルに設定を追加します。
code
Env
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
config/services.php に設定を追加:
code
PHP
'google' => [
    'project_id' => env('GOOGLE_PROJECT_ID'),
],
4. コントローラーでの使用
code
PHP
<?php

namespace App\Http\Controllers;

use App\Services\GoogleEmbeddingService;
use Illuminate\Http\Request;

class VectorController extends Controller
{
    public function store(Request $request, GoogleEmbeddingService $embedder)
    {
        $request->validate(['text' => 'required|string']);
        
        $text = $request->input('text');
        
        // ベクトル化
        $vector = $embedder->getVector($text);

        // 例: pgvectorを入れたPostgreSQLなどに保存
        // $model->embedding = json_encode($vector);
        // $model->save();

        return response()->json([
            'text' => $text,
            'vector_preview' => array_slice($vector, 0, 5), // 最初の5次元だけ表示
            'dimension' => count($vector)
        ]);
    }
}
まとめ
特徴	Next.js (Transformers.js)	Laravel (Vertex AI API)
コスト	無料 (クライアント/サーバーのリソース依存)	有料 (従量課金、ただし安価)
モデル	BERT (Open Source)	Gecko / Gemini (Google Propreitary)
精度	モデルサイズによる (軽量版は精度低め)	非常に高い
日本語	多言語モデル(Multilingual)が必要	標準で完全対応
導入	npm install だけで完結	GCP契約とAPI設定が必要
推奨:
学習や小規模なプロトタイプ作成なら Next.js + Transformers.js が手軽です。
本番環境で高品質な日本語検索やRAG（検索拡張生成）を行いたい場合は、Laravel + Google Vertex AI が適しています。