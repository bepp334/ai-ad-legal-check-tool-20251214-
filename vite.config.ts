import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Vercelではprocess.envから、ローカル開発では.envファイルから読み込む
    const env = loadEnv(mode, '.', '');
    
    // 優先順位: 1. Vercelの環境変数 (process.env) 2. .envファイル
    // ビルド時に環境変数が利用可能か確認
    const vercelApiKey = process.env.GEMINI_API_KEY;
    const localApiKey = env.GEMINI_API_KEY;
    const apiKey = vercelApiKey || localApiKey || '';
    
    // デバッグ情報を出力（ビルド時に確認可能）
    console.log('🔍 環境変数の読み込み状況:');
    console.log(`   - Vercel環境変数 (process.env.GEMINI_API_KEY): ${vercelApiKey ? '✅ 設定済み' : '❌ 未設定'}`);
    console.log(`   - ローカル環境変数 (.envファイル): ${localApiKey ? '✅ 設定済み' : '❌ 未設定'}`);
    
    if (!apiKey) {
      console.error('❌ エラー: GEMINI_API_KEYが設定されていません。');
      console.error('   ローカル開発の場合:');
      console.error('     .envファイルをプロジェクトのルートに作成し、以下を記述してください:');
      console.error('     GEMINI_API_KEY=your_api_key_here');
      console.error('   Vercelの場合:');
      console.error('     1. Vercelダッシュボードにログイン');
      console.error('     2. プロジェクトを選択');
      console.error('     3. Settings > Environment Variables を開く');
      console.error('     4. Name: GEMINI_API_KEY, Value: あなたのAPIキー を設定');
      console.error('     5. すべての環境（Production, Preview, Development）にチェック');
      console.error('     6. Save をクリックして再デプロイ');
    } else {
      const source = vercelApiKey ? 'Vercel環境変数' : '.envファイル';
      const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
      console.log(`✅ GEMINI_API_KEYが正常に読み込まれました (${source})`);
      console.log(`   APIキー: ${maskedKey}`);
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
