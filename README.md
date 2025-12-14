<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19hcQdUySCXlSVZ1XR8WEb-f1-utFEWwq

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and set your API keys:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   ⚠️ **重要**: `.env`ファイルは`.gitignore`に含まれているため、Gitにコミットされません。APIキーを安全に管理できます。
   
   **Supabaseの設定方法:**
   1. [Supabase](https://supabase.com/)でプロジェクトを作成
   2. プロジェクトのSettings > APIから以下を取得:
      - `Project URL` → `VITE_SUPABASE_URL`
      - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   3. `supabase/schema.sql`をSupabaseのSQL Editorで実行してテーブルを作成

3. Run the app:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
