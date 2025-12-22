-- Supabaseデータベーススキーマ
-- このSQLをSupabaseのSQL Editorで実行してください

-- チェック結果テーブル
CREATE TABLE IF NOT EXISTS ad_check_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_text TEXT NOT NULL,
  final_report TEXT NOT NULL,
  step3_fact_base TEXT,
  reference_urls TEXT,
  client_shared_info TEXT,
  ng_items JSONB, -- NG項目の配列 [{category, itemName, status, issue, suggestion}]
  has_ng BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_ad_check_results_created_at ON ad_check_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_check_results_has_ng ON ad_check_results(has_ng);
CREATE INDEX IF NOT EXISTS idx_ad_check_results_ng_items ON ad_check_results USING GIN(ng_items);

-- RLS (Row Level Security) の設定
-- 注意: 本番環境では適切な認証ポリシーを設定してください
ALTER TABLE ad_check_results ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow all operations for all users" ON ad_check_results;

-- 全ユーザーが読み書き可能なポリシー（開発用）
-- 本番環境では、認証済みユーザーのみに制限することを推奨
CREATE POLICY "Allow all operations for all users" ON ad_check_results
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- updated_atを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS update_ad_check_results_updated_at ON ad_check_results;

-- updated_atトリガーの作成
CREATE TRIGGER update_ad_check_results_updated_at
  BEFORE UPDATE ON ad_check_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- コメントの追加
COMMENT ON TABLE ad_check_results IS '広告リーガルチェック結果を保存するテーブル';
COMMENT ON COLUMN ad_check_results.ng_items IS 'NG項目の配列。JSONB形式で保存。';
COMMENT ON COLUMN ad_check_results.has_ng IS 'NG項目が存在するかどうかのフラグ';

