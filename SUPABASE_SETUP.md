# Supabase設定ガイド

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスしてアカウントを作成（またはログイン）
2. 「New Project」をクリックして新しいプロジェクトを作成
3. プロジェクト名、データベースパスワード、リージョンを設定
4. プロジェクトの作成完了を待つ（数分かかります）

## 2. データベーステーブルの作成

1. Supabaseダッシュボードで、左メニューから「SQL Editor」を開く
2. `supabase/schema.sql`ファイルの内容をコピー
3. SQL Editorに貼り付けて「Run」をクリック
4. テーブルが正常に作成されたことを確認

## 3. 環境変数の取得

1. Supabaseダッシュボードで、左メニューから「Settings」→「API」を開く
2. 以下の情報をコピー:
   - **Project URL** → `VITE_SUPABASE_URL`として使用
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`として使用

## 4. ローカル開発環境の設定

プロジェクトのルートに`.env`ファイルを作成（既にある場合は追記）:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 5. Vercel環境変数の設定

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. 「Settings」→「Environment Variables」を開く
4. 以下の環境変数を追加:
   - **Name**: `VITE_SUPABASE_URL`
     **Value**: SupabaseのProject URL
     **Environment**: Production, Preview, Development すべてにチェック
   
   - **Name**: `VITE_SUPABASE_ANON_KEY`
     **Value**: Supabaseのanon public key
     **Environment**: Production, Preview, Development すべてにチェック

5. 「Save」をクリック
6. 「Deployments」タブから手動で再デプロイを実行

⚠️ **重要**: 環境変数を設定した後、必ず再デプロイが必要です！

## 6. 動作確認

1. アプリを起動して広告チェックを実行
2. NG項目がある場合、自動的にSupabaseに保存されます
3. Supabaseダッシュボードの「Table Editor」で`ad_check_results`テーブルを確認
4. データが保存されていることを確認

## セキュリティについて

現在の設定では、RLS（Row Level Security）ポリシーが「全ユーザーが読み書き可能」になっています。
本番環境では、適切な認証ポリシーを設定することを強く推奨します。

### 推奨されるセキュリティ設定

1. Supabaseダッシュボードで「Authentication」を設定
2. `supabase/schema.sql`のRLSポリシーを修正:
   ```sql
   -- 認証済みユーザーのみ読み書き可能
   CREATE POLICY "Allow authenticated users" ON ad_check_results
     FOR ALL
     USING (auth.role() = 'authenticated')
     WITH CHECK (auth.role() = 'authenticated');
   ```

