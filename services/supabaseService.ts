import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 環境変数からSupabaseのURLとAPIキーを取得
const getSupabaseConfig = () => {
  // Viteの環境変数から取得（Vercelでは環境変数として設定）
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase環境変数が設定されていません。');
    console.warn('   ローカル開発の場合: .envファイルに以下を追加してください:');
    console.warn('   VITE_SUPABASE_URL=your_supabase_url');
    console.warn('   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
    console.warn('   Vercelの場合: 環境変数として設定してください');
    return null;
  }
  
  return { supabaseUrl, supabaseAnonKey };
};

// Supabaseクライアントの初期化
let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseClient) {
    return supabaseClient;
  }
  
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }
  
  try {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabaseClient;
  } catch (error) {
    console.error('Supabaseクライアントの初期化に失敗しました:', error);
    return null;
  }
};

// NG項目を抽出する関数（Markdownレポートから）
export const extractNGItems = (reportMarkdown: string): {
  ngItems: Array<{
    category: string;
    itemName: string;
    status: string;
    issue: string;
    suggestion: string;
  }>;
  hasNG: boolean;
} => {
  const ngItems: Array<{
    category: string;
    itemName: string;
    status: string;
    issue: string;
    suggestion: string;
  }> = [];
  
  let hasNG = false;
  
  // 「## 2. 【最重要】修正が必要な項目」セクションを抽出
  const ngSectionMatch = reportMarkdown.match(/## 2\.\s*【最重要】修正が必要な項目\s*([\s\S]*?)(?=## 3\.|🎉|$)/);
  if (!ngSectionMatch) {
    return { ngItems: [], hasNG: false };
  }
  
  const ngSection = ngSectionMatch[1];
  
  // テーブルを抽出（Markdown形式）
  const tableRegex = /\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/g;
  let match;
  let currentCategory = '';
  
  // カテゴリーを検出（### で始まる行）
  const categoryMatches = ngSection.match(/### ([\d\-]+\.\s*[^\n]+)/g);
  const lines = ngSection.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // カテゴリー行を検出
    if (line.startsWith('### ')) {
      currentCategory = line.replace('### ', '').trim();
      continue;
    }
    
    // テーブル行を検出（判定列にNG❌が含まれる行のみ）
    if (line.includes('|') && line.includes('NG❌')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      if (cells.length >= 4) {
        // ヘッダー行はスキップ
        if (cells[0].includes('項目名') || cells[0].includes('チェック項目') || cells[0].includes('No.')) {
          continue;
        }
        
        // 判定列を確認
        const statusIndex = cells.findIndex(c => c.includes('NG❌') || c.includes('OK✅'));
        if (statusIndex === -1) continue;
        
        const status = cells[statusIndex];
        if (!status.includes('NG❌')) continue;
        
        hasNG = true;
        
        // 列の構造に応じて項目名、指摘事項、修正提案を抽出
        let itemName = cells[0] || '';
        let issue = '';
        let suggestion = '';
        
        if (cells.length === 4) {
          // 4列テーブル: 項目名 | 判定 | 指摘事項 | 修正提案
          issue = cells[2] || '';
          suggestion = cells[3] || '';
        } else if (cells.length === 5) {
          // 5列テーブル: No. | チェックカテゴリー | チェック項目 | 判定 | 指摘事項 | 修正提案
          itemName = cells[2] || cells[0] || '';
          issue = cells[4] || '';
          suggestion = cells[5] || '';
        } else if (cells.length === 6) {
          // 6列テーブル: カテゴリ | チェック項目 | 判定 | 指摘事項 | 修正提案 | 参照
          itemName = cells[1] || '';
          issue = cells[3] || '';
          suggestion = cells[4] || '';
        }
        
        ngItems.push({
          category: currentCategory || 'その他',
          itemName: itemName.trim(),
          status: status.trim(),
          issue: issue.trim(),
          suggestion: suggestion.trim(),
        });
      }
    }
  }
  
  return { ngItems, hasNG };
};

// チェック結果を保存する関数
export interface CheckResultData {
  adText: string;
  finalReport: string;
  step3FactBase: string | null;
  referenceUrls: string | null;
  clientSharedInfo: string | null;
  createdAt?: string;
}

export const saveCheckResult = async (data: CheckResultData): Promise<{
  success: boolean;
  checkId?: string;
  error?: string;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabaseクライアントが初期化されていません。環境変数を確認してください。',
    };
  }
  
  // NG項目を抽出
  const { ngItems, hasNG } = extractNGItems(data.finalReport);
  
  // NG項目がない場合は保存しない（オプション: すべて保存する場合はこの条件を削除）
  if (!hasNG) {
    return {
      success: false,
      error: 'NG項目が見つかりませんでした。NG項目がある場合のみ保存されます。',
    };
  }
  
  try {
    const { data: insertedData, error } = await client
      .from('ad_check_results')
      .insert({
        ad_text: data.adText,
        final_report: data.finalReport,
        step3_fact_base: data.step3FactBase,
        reference_urls: data.referenceUrls,
        client_shared_info: data.clientSharedInfo,
        ng_items: ngItems,
        has_ng: hasNG,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Supabase保存エラー:', error);
      return {
        success: false,
        error: error.message || 'データの保存に失敗しました。',
      };
    }
    
    return {
      success: true,
      checkId: insertedData?.id,
    };
  } catch (error) {
    console.error('予期しないエラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました。',
    };
  }
};

// 保存されたチェック結果を取得する関数
export const getCheckResults = async (limit: number = 50): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabaseクライアントが初期化されていません。',
    };
  }
  
  try {
    const { data, error } = await client
      .from('ad_check_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Supabase取得エラー:', error);
      return {
        success: false,
        error: error.message || 'データの取得に失敗しました。',
      };
    }
    
    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('予期しないエラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予期しないエラーが発生しました。',
    };
  }
};

