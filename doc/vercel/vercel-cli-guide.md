# Vercel CLI ガイド

## 概要
Vercel CLIはVercelプラットフォームをコマンドラインから操作するためのツールです。

## インストール

```bash
npm install -g vercel
```

## バージョン確認

```bash
vercel --version
```

## ログイン

```bash
vercel login
```

ブラウザが開き、認証コードを入力してログインを完了します。

## 基本コマンド

### デプロイ

```bash
# プレビュー環境にデプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

### ローカル開発

```bash
# ローカル開発サーバー起動
vercel dev
```

### 環境変数管理

```bash
# 環境変数一覧
vercel env ls

# 環境変数追加
vercel env add <NAME>

# 環境変数削除
vercel env rm <NAME>

# 環境変数をローカルにプル
vercel env pull
```

### ドメイン管理

```bash
# ドメイン一覧
vercel domains ls

# ドメイン追加
vercel domains add <domain>

# ドメイン削除
vercel domains rm <domain>
```

### プロジェクト管理

```bash
# プロジェクト一覧
vercel projects ls

# プロジェクトをリンク
vercel link

# プロジェクト情報
vercel inspect <deployment-url>
```

### ログ確認

```bash
# デプロイメントログ
vercel logs <deployment-url>

# リアルタイムログ
vercel logs <deployment-url> --follow
```

### シークレット管理

```bash
# シークレット一覧
vercel secrets ls

# シークレット追加
vercel secrets add <name> <value>

# シークレット削除
vercel secrets rm <name>
```

## よく使うオプション

| オプション | 説明 |
|-----------|------|
| `--prod` | 本番環境にデプロイ |
| `--yes` | 確認プロンプトをスキップ |
| `--force` | キャッシュを無視して再デプロイ |
| `--debug` | デバッグ情報を表示 |
| `--token <token>` | 認証トークンを指定 |

## プロジェクト設定ファイル

プロジェクトルートに `vercel.json` を配置して設定をカスタマイズできます。

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## Git連携

```bash
# GitHubリポジトリと連携
vercel git connect
```

自動デプロイを設定するには、Vercelダッシュボードからリポジトリを接続します。

## トラブルシューティング

### ログインできない場合

```bash
# 既存の認証情報をクリア
vercel logout
vercel login
```

### デプロイが失敗する場合

```bash
# ビルドログを確認
vercel logs <deployment-url>

# デバッグモードでデプロイ
vercel --debug
```

### キャッシュの問題

```bash
# キャッシュを無視してデプロイ
vercel --force
```

## 参考リンク

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Dashboard](https://vercel.com/dashboard)
