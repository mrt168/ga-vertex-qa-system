ご要望の要件（社内QA、Vertex AI Gemini、Google File Search API、遺伝的アルゴリズムによる自己進化）を整理し、開発メンバーやステークホルダーに共有できる**基本設計書（Markdown形式）**を作成しました。

この設計書は、単なるRAGシステムではなく、**「運用中に自動で賢くなる（ドキュメントが書き換わる）システム」**という特徴を定義しています。

---

# 自己進化型 社内QAシステム 基本設計書

**バージョン:** 1.0  
**作成日:** 2025/12/06  
**概要:** 遺伝的アルゴリズム（GA）の概念をLLMに応用し、ユーザーフィードバックに基づいてナレッジベース（Markdown）を自律的に改善・最適化するQAシステム。

---

## 1. プロジェクトの目的

*   **回答精度の継続的向上:** 初期構築時の精度に依存せず、運用データの蓄積により回答品質を自動向上させる。
*   **ナレッジの陳腐化防止:** ユーザーからの指摘や低評価をトリガーに、ドキュメント（Markdown）の内容を自動更新・修正する。
*   **運用コストの削減:** 人手によるFAQメンテナンス工数を最小限に抑え、AIが「書き換え案」を作成・評価・反映するループを構築する。

## 2. システムアーキテクチャ概要

本システムは、通常の「回答生成フロー（RAG）」と、非同期で実行される「学習・進化フロー（GA）」の2つのループで構成される。

### 2.1 全体構成図（概念）

```mermaid
graph TD
    User[社員ユーザー] -->|質問| QA_UI[QAインターフェース]
    QA_UI -->|検索 & 回答生成| Gemini[Vertex AI Gemini 3.0]
    Gemini <-->|参照| SearchAPI[Google File Search API / Drive]
    
    User -->|フィードバック (Good/Bad)| FB_DB[(Firestore: 評価ログ)]
    
    subgraph "進化エンジン (Nightly Batch / Event Driven)"
        FB_DB -->|データ取得| Controller[Cloud Workflows (司令塔)]
        Controller -->|変異・交叉| Mutator[Gemini (変異演算子)]
        Mutator -->|候補生成| Candidates[修正案リスト A, B, C...]
        Candidates -->|対戦評価| Evaluator[Vertex AI Evaluation (AutoSxS)]
        Evaluator -->|勝者選定| Winner[最適化されたMarkdown]
        Winner -->|更新| SearchAPI
    end
```

## 3. 技術スタック

| カテゴリ | AWSサービス / 技術 | 役割 |
| :--- | :--- | :--- |
| **LLM (Model)** | **Vertex AI Gemini 3.0 Pro** | 回答生成、およびGAにおける「変異（書き換え）」「交叉（統合）」を担当。 |
| **Search / RAG** | **Vertex AI Agent Builder**<br>(with Google Drive Data Store) | 社内ドキュメント（Markdown）のインデックス化と検索。 |
| **Evaluation** | **Vertex AI Evaluation**<br>(AutoSxS: Pairwise) | 新旧のドキュメントを用いた回答精度をAI同士で対戦させ判定する（適応度関数）。 |
| **Orchestration** | **Cloud Workflows** | 進化プロセスの順序制御、エラーハンドリング。 |
| **Database** | **Firestore** | ユーザーフィードバック、改善履歴、QAログの保存。 |
| **Storage** | **Google Drive** | ナレッジベース本体（Markdownファイル）の保存場所。 |
| **Trigger** | **Cloud Scheduler** | 進化プロセスの定期実行（例: 深夜バッチ）。 |

---

## 4. 進化アルゴリズム（GA）の実装詳細

従来のGA（ビット列操作）ではなく、**LLMを用いた進化的プロンプティング（Evolutionary Prompting）**を採用する。

### 4.1 定義

*   **遺伝子 (Genotype):** Markdownファイルのテキストデータ。
*   **表現型 (Phenotype):** そのMarkdownを参照して生成された「回答」。
*   **適応度 (Fitness):** Vertex AI Evaluationによる評価スコア（正確性、有用性、安全性）。

### 4.2 進化プロセス（Evolution Loop）

このプロセスは、フィードバックが一定数蓄積されたファイルに対してバッチ処理で実行する。

#### STEP 1: 初期化 (Initialization) & 選択 (Selection)
*   低評価が付いたMarkdownファイル（親個体）を特定する。
*   関連するユーザーの「不満ログ（質問内容と低評価理由）」を取得する。

#### STEP 2: 生殖 (Reproduction) - LLMによる演算
Geminiに対し、以下のプロンプト戦略を用いて次世代の候補（Markdown修正案）を複数生成させる。

*   **突然変異 (Mutation):**
    *   *プロンプト:* 「このドキュメントは『{質問}』に対し情報不足でした。不足情報を補足し、より初心者にわかりやすい構成に**書き換えてください**。」
    *   *生成数:* 3パターン（詳細版、簡易版、Q&A特化版など）。
*   **交叉 (Crossover):** （新情報がある場合のみ）
    *   *プロンプト:* 「現行のMarkdownと、新規に追加されたPDF資料を統合し、両方の情報を含む新しいMarkdownを作成してください。」

#### STEP 3: 評価 (Evaluation) - AutoSxS
生成された候補（修正案）それぞれを一時的なナレッジとして、過去の質問に対する回答をシミュレーション生成する。
*   **判定員:** Vertex AI Evaluation (AutoSxS)
*   **基準:** 「現行ファイル」vs「修正案ファイル」でペアワイズ評価を行う。
*   **メトリクス:** Helpfulness（役立ち度）、Correctness（正確性）。

#### STEP 4: 淘汰と更新 (Survival & Update)
*   現行ファイルよりも**有意にスコアが高い修正案**が存在した場合、「勝者」として採用する。
*   Google Drive API経由で対象のMarkdownファイルを上書き更新する。
*   更新履歴をFirestoreに記録する（ロールバック用）。

---

## 5. データモデル設計

### 5.1 Feedback Log (Firestore: `feedback_logs`)
ユーザーからの評価を蓄積し、進化の種とする。

```json
{
  "log_id": "uuid",
  "document_id": "drive_file_id_12345", // 対象ファイル
  "user_query": "交通費精算のやり方は？",
  "ai_response": "...", 
  "rating": "BAD", // GOOD or BAD
  "feedback_text": "経路の登録方法が書いていない", // 任意入力
  "timestamp": "2025-12-06T10:00:00Z",
  "processed": false // 進化プロセスで使用済みか
}
```

### 5.2 Evolution History (Firestore: `evolution_history`)
AIがどのようにファイルを書き換えたかの履歴。

```json
{
  "execution_id": "exec_abcde",
  "document_id": "drive_file_id_12345",
  "generation": 3, // 第3世代
  "mutation_type": "MUTATION_CLARITY", // 明確化のための変異
  "win_rate": 1.0, // AutoSxSでの勝率
  "previous_content_snapshot": "gs://bucket/backup/ver2.md",
  "updated_at": "2025-12-07T02:00:00Z"
}
```

---

## 6. 開発フェーズ

### Phase 1: 基本RAGの実装
*   Vertex AI Agent Builderを使用し、Google Drive上のMarkdownを検索できるQAボットを作成。
*   Gemini 3.0 Proによる回答生成の実装。
*   UIへのフィードバックボタン（Good/Bad）設置。

### Phase 2: 自動評価パイプラインの構築 (Evaluation)
*   Pythonスクリプトによる Vertex AI Evaluation の導入。
*   手動で用意した修正案と現行案を比較し、AutoSxSが正しく判定できるか検証。
*   ペルソナ（新人、ベテラン）の設定。

### Phase 3: 進化ループの自動化 (Evolution)
*   Cloud Workflowsによる「修正案生成 → 評価 → 更新」の自動化。
*   まずは人間が承認ボタンを押す「半自動（Human-in-the-loop）」で運用開始。

### Phase 4: 完全自律運用
*   閾値調整を行い、夜間バッチによる完全自動更新へ移行。

---

## 7. 懸念点と対策

*   **コスト:** 生成と評価を繰り返すため、APIコストが増加しやすい。
    *   *対策:* 進化のトリガーを「低評価3回以上」等に制限する。
*   **改悪リスク:** AIが誤った情報を書き込む可能性がある。
    *   *対策:* 「退行テスト（Regression Test）」を組み込み、過去の優良Q&Aの回答精度が落ちていないか確認してから更新する。
*   **ハルシネーション:** Markdownに嘘の内容を生成してしまう。
    *   *対策:* AutoSxSのプロンプトに「事実に基づかない記述は最低評価にする」ルールを厳格化する。