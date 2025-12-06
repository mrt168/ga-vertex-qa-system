# GA進化システム - 技術ドキュメント

## 概要

本システムは、遺伝的アルゴリズム（GA）の概念をLLMとドキュメント管理に応用し、ユーザーフィードバックに基づいてナレッジベースを自律的に改善・最適化するシステムです。

### 主要コンセプト

| GA用語 | 本システムでの意味 |
|--------|-------------------|
| **遺伝子 (Genotype)** | Markdownファイルのテキストデータ |
| **表現型 (Phenotype)** | そのMarkdownを参照して生成された「回答」 |
| **適応度 (Fitness)** | Vertex AI Evaluationによる評価スコア |
| **突然変異 (Mutation)** | ドキュメントの書き換え |
| **交叉 (Crossover)** | 複数ドキュメントの統合 |
| **選択 (Selection)** | ペアワイズ評価による勝者選定 |

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        QA System                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   User      │───▶│   Chat      │───▶│   Gemini    │        │
│  │   Query     │    │   API       │    │   Response  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                                      │               │
│         ▼                                      ▼               │
│  ┌─────────────┐                       ┌─────────────┐        │
│  │  Feedback   │                       │  Document   │        │
│  │  (GOOD/BAD) │                       │  Source     │        │
│  └─────────────┘                       └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Evolution System                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Identify   │───▶│  Generate   │───▶│  Evaluate   │        │
│  │  Targets    │    │  Mutations  │    │  Candidates │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                                      │               │
│         │           ┌─────────────┐            │               │
│         └──────────▶│   Select    │◀───────────┘               │
│                     │   Winner    │                            │
│                     └─────────────┘                            │
│                            │                                   │
│                            ▼                                   │
│                     ┌─────────────┐                            │
│                     │   Update    │                            │
│                     │   Document  │                            │
│                     └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント

### 1. Evolution Library (`src/lib/evolution/`)

#### types.ts - 型定義

```typescript
// 変異タイプ
type MutationType =
  | 'MUTATION_CLARITY'      // 明確化のための変異
  | 'MUTATION_DETAIL'       // 詳細追加
  | 'MUTATION_SIMPLIFY'     // 簡略化
  | 'MUTATION_QA_FORMAT'    // Q&A形式への変換
  | 'CROSSOVER_MERGE'       // 複数ドキュメントの統合
  | 'CROSSOVER_EXTRACT';    // 共通部分の抽出

// ドキュメント候補
interface DocumentCandidate {
  id: string;
  content: string;
  mutationType: MutationType;
  sourceDocumentId: string;
  parentDocumentIds?: string[];
}

// 評価結果
interface EvaluationResult {
  candidateId: string;
  score: number;
  winRate: number;
  metrics: {
    helpfulness: number;   // 有用性 (1-5)
    correctness: number;   // 正確性 (1-5)
    coherence: number;     // 一貫性 (1-5)
  };
}

// 進化設定
interface EvolutionConfig {
  badFeedbackThreshold: number;  // 進化トリガー閾値 (default: 3)
  candidateCount: number;        // 生成する候補数 (default: 3)
  evaluationSampleSize: number;  // 評価サンプル数 (default: 5)
  minWinMargin: number;          // 最小勝利マージン (default: 0.1)
  autoUpdate: boolean;           // 自動更新 (default: false)
}
```

#### mutation-engine.ts - 変異エンジン

3種類の変異を生成：

| タイプ | 目的 | 処理内容 |
|--------|------|----------|
| `MUTATION_CLARITY` | 明確化 | 専門用語の説明追加、曖昧表現の具体化 |
| `MUTATION_DETAIL` | 詳細追加 | 手順・数値・FAQの追加 |
| `MUTATION_QA_FORMAT` | Q&A形式 | よくある質問と回答セクションの追加 |

```typescript
// 使用例
const mutationEngine = getMutationEngine();
const candidates = await mutationEngine.generateMutations(
  documentId,
  currentContent,
  feedbackContexts
);
```

#### evaluation-engine.ts - 評価エンジン

AutoSxS（Pairwise Evaluation）を使用してドキュメント候補を評価：

```typescript
// 評価フロー
1. オリジナルドキュメントと候補ドキュメントから回答を生成
2. 両方の回答をGeminiで比較評価
3. Helpfulness, Correctness, Coherenceの3軸でスコアリング
4. 勝者を決定 (A / B / TIE)
5. 全サンプル質問での勝率を計算
```

#### evolution-workflow.ts - ワークフロー

進化プロセス全体を統合するオーケストレータ：

```typescript
// 実行フロー
const workflow = getEvolutionWorkflow();

// 全対象ドキュメントを進化
const jobs = await workflow.runEvolution();

// 特定ドキュメントのみ進化
const job = await workflow.evolveDocument(documentId);
```

---

### 2. API Endpoints (`src/app/api/evolution/`)

#### POST /api/evolution/run

進化プロセスをトリガー

**リクエスト:**
```json
{
  "documentId": "optional-specific-document-id"
}
```

**レスポンス:**
```json
{
  "success": true,
  "message": "Evolution completed. Processed 3 documents",
  "jobs": [
    {
      "id": "job-uuid",
      "documentId": "doc-uuid",
      "status": "completed",
      "candidates": [...],
      "evaluationResults": [...],
      "winnerCandidateId": "candidate-uuid"
    }
  ]
}
```

#### GET /api/evolution/stats

進化統計情報を取得

**レスポンス:**
```json
{
  "success": true,
  "stats": {
    "feedback": {
      "total": 100,
      "good": 80,
      "bad": 20,
      "pendingBad": 5
    },
    "evolution": {
      "eligibleDocuments": 2,
      "eligibleDocumentIds": ["doc1", "doc2"],
      "totalEvolutions": 10,
      "successfulEvolutions": 7,
      "threshold": 3
    },
    "documents": {
      "total": 50
    }
  }
}
```

#### GET /api/evolution/history

進化履歴を取得

**パラメータ:**
- `documentId` (optional): 特定ドキュメントの履歴のみ
- `limit` (optional): 取得件数 (default: 50)

#### GET /api/evolution/candidates

進化候補を取得

---

### 3. 管理画面 (`src/app/admin/evolution/`)

**URL:** `/admin/evolution`

**機能:**
- 統計ダッシュボード（ドキュメント数、フィードバック数、進化対象数）
- 進化実行ボタン
- 進化履歴テーブル
- 進化統計

---

## データベーススキーマ

### qaev_feedback_logs

フィードバックログを保存

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| document_id | uuid | 参照ドキュメント |
| user_query | text | ユーザーの質問 |
| ai_response | text | AIの回答 |
| rating | text | 'GOOD' or 'BAD' |
| feedback_text | text | 追加コメント |
| processed | boolean | 進化処理済みフラグ |
| created_at | timestamp | 作成日時 |

### qaev_evolution_history

進化履歴を保存

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| document_id | uuid | 対象ドキュメント |
| generation | integer | 世代番号 |
| mutation_type | text | 変異タイプ |
| win_rate | float | 勝率 |
| trigger_feedback_ids | uuid[] | トリガーフィードバック |
| previous_content_snapshot | text | 変更前コンテンツ |
| new_content_snapshot | text | 変更後コンテンツ |
| rollback_available | boolean | ロールバック可能 |
| created_at | timestamp | 作成日時 |

---

## 進化プロセスの詳細

### Step 1: 進化対象の特定

```
1. 未処理の低評価フィードバック (rating='BAD', processed=false) を取得
2. ドキュメントごとにグループ化
3. 閾値 (badFeedbackThreshold=3) 以上のドキュメントを抽出
4. Google Driveから最新コンテンツを取得
```

### Step 2: 変異生成

```
1. 各対象ドキュメントに対して3種類の変異を生成
   - MUTATION_CLARITY: 明確化
   - MUTATION_DETAIL: 詳細追加
   - MUTATION_QA_FORMAT: Q&A形式
2. Geminiを使用してドキュメントを書き換え
3. フィードバック内容を考慮した改善を反映
```

### Step 3: 評価

```
1. サンプル質問を準備（低評価フィードバックの質問 + 過去の良い評価の質問）
2. 各候補に対してペアワイズ評価を実行
   a. オリジナルドキュメントから回答生成
   b. 候補ドキュメントから回答生成
   c. 両回答を比較評価
3. 勝率を計算
```

### Step 4: 勝者選定

```
1. 勝率が最も高い候補を選択
2. 勝率が 50% + minWinMargin (10%) = 60% 以上の場合のみ勝者とする
3. それ以下の場合はオリジナルを維持
```

### Step 5: 更新と記録

```
1. autoUpdate=true の場合、ドキュメントを更新
2. フィードバックを処理済みにマーク
3. 進化履歴を記録
```

---

## 設定パラメータ

```typescript
const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  badFeedbackThreshold: 3,    // 3件以上の低評価で進化トリガー
  candidateCount: 3,          // 3種類の変異を生成
  evaluationSampleSize: 5,    // 5件の質問で評価
  minWinMargin: 0.1,          // 10%以上の勝率差で勝者判定
  autoUpdate: false,          // デフォルトは人間の承認が必要
};
```

---

## 使用方法

### 1. 進化の手動実行

```bash
# APIを直接呼び出し
curl -X POST http://localhost:3000/api/evolution/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"

# 特定ドキュメントのみ
curl -X POST http://localhost:3000/api/evolution/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"documentId": "document-uuid"}'
```

### 2. 管理画面から実行

1. `/admin/evolution` にアクセス
2. 「進化を実行」ボタンをクリック
3. 結果を確認

### 3. 統計の確認

```bash
curl http://localhost:3000/api/evolution/stats \
  -H "Authorization: Bearer <token>"
```

---

## 今後の拡張

### Phase 4: 自律運用

- [ ] Cloud Scheduler による定期実行
- [ ] Slack/Email 通知
- [ ] 自動承認ワークフロー

### 追加機能

- [ ] 交叉 (Crossover) エンジンの実装
- [ ] ロールバック機能
- [ ] A/Bテスト機能
- [ ] 進化効果の分析ダッシュボード

---

## ファイル構成

```
src/lib/evolution/
├── index.ts              # エントリーポイント
├── types.ts              # 型定義
├── mutation-engine.ts    # 変異エンジン
├── evaluation-engine.ts  # 評価エンジン
└── evolution-workflow.ts # ワークフロー

src/app/api/evolution/
├── run/route.ts          # 進化実行API
├── stats/route.ts        # 統計API
├── history/route.ts      # 履歴API
└── candidates/route.ts   # 候補API

src/app/admin/evolution/
└── page.tsx              # 管理画面
```

---

## 参考資料

- [Vertex AI Evaluation](https://cloud.google.com/vertex-ai/docs/generative-ai/models/evaluate-models)
- [AutoSxS: Automatic Evaluation by Side-by-Side Comparison](https://arxiv.org/abs/2310.00556)
- [遺伝的アルゴリズム - Wikipedia](https://ja.wikipedia.org/wiki/%E9%81%BA%E4%BC%9D%E7%9A%84%E3%82%A2%E3%83%AB%E3%82%B4%E3%83%AA%E3%82%BA%E3%83%A0)
