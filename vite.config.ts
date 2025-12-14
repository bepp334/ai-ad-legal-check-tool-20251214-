import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Vercelではprocess.envから、ローカル開発では.envファイルから読み込む
    const env = loadEnv(mode, '.', '');
    // 優先順位: 1. Vercelの環境変数 (process.env) 2. .envファイル
    const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️  警告: GEMINI_API_KEYが設定されていません。');
      console.warn('   ローカル開発: .envファイルに GEMINI_API_KEY=your_api_key を設定してください。');
      console.warn('   Vercel: プロジェクト設定 > Environment Variables で GEMINI_API_KEY を設定してください。');
    } else {
      const source = process.env.GEMINI_API_KEY ? 'Vercel環境変数' : '.envファイル';
      console.log(`✅ GEMINI_API_KEYが正常に読み込まれました (${source})。`);
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
