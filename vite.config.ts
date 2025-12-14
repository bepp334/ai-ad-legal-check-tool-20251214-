import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiKey = env.GEMINI_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️  警告: GEMINI_API_KEYが.envファイルに設定されていません。');
      console.warn('   .envファイルに GEMINI_API_KEY=your_api_key を設定してください。');
    } else {
      console.log('✅ GEMINI_API_KEYが正常に読み込まれました。');
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
