結論から申し上げますと、**「資料の管理（保存・更新）」はGoogle Drive**で行い、**「資料の検索（回答生成用）」はVertex AI Search（Agent Builder）**を経由するという**ハイブリッド構成**がベストプラクティスです。

Google Drive APIを**直接検索に使ってはいけません**。理由は以下の通りです。

### なぜ直接Drive検索ではダメなのか？

1. **検索精度が低い:** Drive APIの検索は単なる「キーワード一致」です。
   * *Drive API:* 「交通費」で検索 → ファイル名や本文に「交通費」がないとヒットしない。
   * *Vertex AI Search:* 「電車代の申請どうやるの？」で検索 → 「交通費精算規定.md」がヒットする（**ベクトル検索/意味検索**ができる）。
2. **RAGに不向き:** Drive APIはファイル丸ごとしか返しません。Vertex AI Searchは「ファイルの**どの部分（チャンク）**が質問に関連しているか」を切り出して返してくれるため、Geminiに渡すトークン数を節約できます。

---

### 推奨アーキテクチャ

* **資料登録・編集（GAによる進化）:** **Google Drive API** を使用
* **資料参照（QA回答時）:** **Vertex AI Search API** を使用（裏側でDriveと同期）

以下に、**「Google Drive API (Node.js)」を用いた資料登録・参照・更新（GA用）の実装コード**をMarkdownで提示します。

---

# Google Drive API 実装ガイド (Node.js)

このAPIは、システムが新しいMarkdownを**登録（アップロード）**したり、GAによって生成された新しい内容で**上書き更新**したりするために使用します。

## 1. 準備

### 1.1 ライブラリのインストール

```bash
npm install googleapis
```

### 1.2 サービスアカウントの権限設定

1. Google Cloud Consoleでサービスアカウントを作成し、キー(JSON)をダウンロード。
2. **重要:** そのサービスアカウントのメールアドレス（`xxx@project-id.iam.gserviceaccount.com`）に対して、Google Driveの対象フォルダの「編集者」権限を共有（招待）してください。

## 2. API実装コード (`drive_manager.js`)

```javascript
const { google } = require('googleapis');
const fs = require('fs');
const stream = require('stream');

// 認証設定 (ADC または キーファイルパス)
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/drive'],
  // keyFile: './service-account-key.json' // ローカル開発時は指定
});

const drive = google.drive({ version: 'v3', auth });

/**
 * 1. 資料登録 (新規アップロード)
 * 社内データなどを新しくシステムに追加する場合
 */
async function uploadMarkdown(fileName, content, folderId) {
  // 文字列をストリームに変換
  const bufferStream = new stream.PassThrough();
  bufferStream.end(content);

  const fileMetadata = {
    name: fileName,
    parents: [folderId], // 保存先のフォルダID
    mimeType: 'text/markdown'
  };

  const media = {
    mimeType: 'text/markdown',
    body: bufferStream
  };

  try {
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    console.log('File Uploaded ID:', file.data.id);
    return file.data.id;
  } catch (err) {
    console.error('Upload Failed:', err);
  }
}

/**
 * 2. 資料参照 (中身のテキストを取得)
 * GAで「進化させる」ために、現在の内容を読み込む場合
 */
async function getMarkdownContent(fileId) {
  try {
    const res = await drive.files.get({
      fileId: fileId,
      alt: 'media' // これを指定すると中身のテキストが返る
    }, { responseType: 'stream' });

    return new Promise((resolve, reject) => {
      let data = '';
      res.data
        .on('data', chunk => data += chunk)
        .on('end', () => resolve(data))
        .on('error', err => reject(err));
    });
  } catch (err) {
    console.error('Read Failed:', err);
    return null;
  }
}

/**
 * 3. 資料更新 (上書き保存)
 * GAで「進化した内容」を反映させる場合
 */
async function updateMarkdown(fileId, newContent) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(newContent);

  const media = {
    mimeType: 'text/markdown',
    body: bufferStream
  };

  try {
    const file = await drive.files.update({
      fileId: fileId,
      media: media,
      fields: 'id, modifiedTime' // 確認用に更新日時を取得
    });
    console.log(`File Updated: ${file.data.id} at ${file.data.modifiedTime}`);
    return true;
  } catch (err) {
    console.error('Update Failed:', err);
    return false;
  }
}

// --- 使い方サンプル ---
(async () => {
  const FOLDER_ID = 'your-google-drive-folder-id'; // URLの末尾のID

  // 1. 新規作成
  // const newId = await uploadMarkdown('社内規定_v1.md', '# 交通費について\n上限は3万円です。', FOLDER_ID);

  // 2. 読み込み (GAの変異元として取得)
  // const currentContent = await getMarkdownContent(newId);
  // console.log('現在の中身:', currentContent);

  // 3. 更新 (GAで生成した新コンテンツで上書き)
  // await updateMarkdown(newId, '# 交通費について\n上限は5万円に変更されました。\n詳細は経理部へ。');
})();
```

---

### 3. この構成の注意点：インデックスのラグ

Google Drive APIでファイルを更新（`updateMarkdown`）した直後、Vertex AI Search（検索側）には**即座には反映されません**。

* **同期タイミング:** 通常、数分〜数時間のラグがあります（設定によりますが、Driveコネクタの定期同期に依存）。
* **対策:**
  * QAシステムとしては「翌日には反映されている」くらいの運用設計が安全です。
  * GAによる進化プロセスは、このラグを考慮して「夜間に更新し、朝には検索できるようになっている」という**バッチ処理**にするのが、先ほどの設計書とも合致し、最もトラブルが少ないです。
