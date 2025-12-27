
import React, { useState, useEffect } from 'react';
import { AdCheckStep, OCRVerificationItem, StepKey, GroundingMetadata, AdCheckInput } from '../types';
import { generateWordDocument } from '../utils/docxGenerator';

interface StepResultDisplayProps {
  currentAppStep: AdCheckStep;
  getStepData: (stepKey: StepKey) => string | null;
  updateStepData: (stepKey: StepKey, value: string) => void;
  step2NeedsVerification: boolean;
  onOcrVerificationSubmit: () => void;
  onProceedToFinalProcessing: () => void;
  onRecheck: () => void;
  recheckPrompt: string;
  setRecheckPrompt: (prompt: string) => void;
  finalAdTextForRecheck: string | null; // Used to determine if re-check is possible
  groundingMetadata?: GroundingMetadata | null;
  userInput: AdCheckInput | null;
}

interface TableRow {
  [key: string]: string;
}

function parseMarkdownTable(markdown: string): TableRow[] | null {
  const lines = markdown.trim().split('\n').map(line => line.trim());
  if (lines.length < 2) return null;

  const headerLine = lines[0];
  const separatorLine = lines[1];

  if (!headerLine.startsWith('|') || !headerLine.endsWith('|') ||
      !separatorLine.startsWith('|') || !separatorLine.endsWith('|') ||
      !separatorLine.includes('---')) {
    return null; 
  }

  const headers = headerLine.split('|').slice(1, -1).map(h => h.trim());
  if (headers.length === 0) return null;

  const rows: TableRow[] = [];

  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i];
    if (!rowLine.startsWith('|') || !rowLine.endsWith('|')) continue; 

    const cells = rowLine.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length !== headers.length && cells.length > 0) { 
        if (cells.every(c => c === '')) continue; 
        const row: TableRow = {};
        headers.forEach((header, index) => {
          row[header] = cells[index] || ''; 
        });
        rows.push(row);
        continue;
    }
    if(cells.length === 0 && headers.length > 0) continue;

    const row: TableRow = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    rows.push(row);
  }
  return rows.length > 0 ? rows : null;
}

const RenderMarkdownReport: React.FC<{ report: string }> = React.memo(({ report }) => {
  const elements: React.ReactNode[] = [];
  const lines = report.trim().split('\n');
  let currentTableLines: string[] = [];
  let currentParagraphLines: string[] = [];

  function flushParagraph(keySuffix: string | number) {
    if (currentParagraphLines.length > 0) {
      elements.push(
        <pre key={`p-${keySuffix}-${elements.length}`} className="whitespace-pre-wrap break-words text-sm text-slate-300 bg-slate-800/60 p-3 rounded-md shadow leading-relaxed mb-3">
          {currentParagraphLines.join('\n')}
        </pre>
      );
      currentParagraphLines = [];
    }
  }

  function flushTable(keySuffix: string | number) {
    if (currentTableLines.length > 0) {
      const tableData = parseMarkdownTable(currentTableLines.join('\n'));
      if (tableData && tableData.length > 0 && Object.keys(tableData[0]).length > 0) {
        elements.push(
          <div key={`table-wrapper-${keySuffix}-${elements.length}`} className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-slate-600 border border-slate-600 border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-700">
                <tr>
                  {Object.keys(tableData[0]).map((header, hIdx) => (
                    <th key={`${header}-${hIdx}`} scope="col" className="px-3 py-2 text-left font-semibold text-slate-200 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-600">
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/70'}>
                    {Object.values(row).map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 whitespace-pre-wrap text-slate-300 break-words">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      } else { 
        currentParagraphLines.push(...currentTableLines);
        flushParagraph(`table-fallback-${keySuffix}`);
      }
      currentTableLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      flushParagraph(i);
      flushTable(i);
      elements.push(<h2 key={`h2-${i}-${elements.length}`} className="text-2xl font-bold text-purple-300 mt-6 mb-3">{line.substring(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushParagraph(i);
      flushTable(i);
      elements.push(<h3 key={`h3-${i}-${elements.length}`} className="text-xl font-semibold text-purple-400 mt-4 mb-2">{line.substring(4)}</h3>);
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushParagraph(i); 
      currentTableLines.push(line);
    } else {
      flushTable(i); 
      if (line.trim() !== '' || currentParagraphLines.length > 0) {
          currentParagraphLines.push(line);
      }
    }
  }
  flushParagraph('final-p'); 
  flushTable('final-t'); 

  return <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none prose-invert">{elements}</div>;
});


export const StepResultDisplay: React.FC<StepResultDisplayProps> = ({
  currentAppStep,
  getStepData,
  updateStepData,
  step2NeedsVerification,
  onOcrVerificationSubmit,
  onProceedToFinalProcessing,
  onRecheck,
  recheckPrompt,
  setRecheckPrompt,
  finalAdTextForRecheck,
  groundingMetadata,
  userInput,
}) => {
  const [editableOcrText, setEditableOcrText] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    setEditableOcrText(getStepData('step2CorrectedOcrText') || getStepData('step2RawOcrText') || '');
  }, [currentAppStep, getStepData]);

  const handleOcrTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableOcrText(event.target.value);
    updateStepData('step2CorrectedOcrText', event.target.value);
  };
  
  // 画像をリサイズしてbase64に変換する関数（Notionの制限に対応）
  const resizeImageForNotion = async (base64String: string, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // アスペクト比を保ちながらリサイズ
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG形式で圧縮（Notionに適した形式）
        const mimeType = 'image/jpeg';
        const resizedBase64 = canvas.toDataURL(mimeType, quality);
        resolve(resizedBase64);
      };
      img.onerror = reject;
      img.src = base64String;
    });
  };

  const handleCopyToClipboard = async () => {
    const reportText = getStepData('step4FinalReport');
    if (!reportText) return;

    try {
      // 参照URLと事実確認サマリーを含めた完全なレポートを作成
      let fullReportText = '';
      let fullReportHtml = '';
      
      // 1. 参照URLセクション
      if (userInput && userInput.referenceUrls && userInput.referenceUrls.trim()) {
        const urls = userInput.referenceUrls
          .split(/[,\n]/)
          .map(url => url.trim())
          .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
        
        if (urls.length > 0) {
          fullReportText += '## 参照URL（事実確認用）\n\n';
          fullReportHtml += '<h2>参照URL（事実確認用）</h2><ul>';
          urls.forEach(url => {
            fullReportText += `- ${url}\n`;
            fullReportHtml += `<li><a href="${url}">${url}</a></li>`;
          });
          fullReportText += '\n---\n\n';
          fullReportHtml += '</ul><hr/>';
        }
      }
      
      // 2. 画像セクション（HTML形式のみ）- リサイズしてから追加
      if (userInput) {
        const hasAdTextImages = userInput.adTextImagesBase64 && userInput.adTextImagesBase64.length > 0;
        const hasCreativeImages = userInput.adCreativeImagesBase64 && userInput.adCreativeImagesBase64.length > 0;
        
        if (hasAdTextImages || hasCreativeImages) {
          fullReportHtml += '<h2>入力画像</h2>';
          
          if (hasAdTextImages) {
            fullReportHtml += '<h3>広告テキスト画像</h3><div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">';
            for (let index = 0; index < userInput.adTextImagesBase64.length; index++) {
              const base64 = userInput.adTextImagesBase64[index];
              try {
                const resizedBase64 = await resizeImageForNotion(base64);
                fullReportHtml += `<img src="${resizedBase64}" alt="広告テキスト画像 ${index + 1}" style="max-width: 300px; max-height: 300px; border: 1px solid #ccc; margin: 5px;" />`;
              } catch (err) {
                console.warn(`画像 ${index + 1} のリサイズに失敗しました。元の画像を使用します。`, err);
                fullReportHtml += `<img src="${base64}" alt="広告テキスト画像 ${index + 1}" style="max-width: 300px; max-height: 300px; border: 1px solid #ccc; margin: 5px;" />`;
              }
            }
            fullReportHtml += '</div>';
          }
          
          if (hasCreativeImages) {
            fullReportHtml += '<h3>広告クリエイティブ画像</h3><div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">';
            for (let index = 0; index < userInput.adCreativeImagesBase64.length; index++) {
              const base64 = userInput.adCreativeImagesBase64[index];
              try {
                const resizedBase64 = await resizeImageForNotion(base64);
                fullReportHtml += `<img src="${resizedBase64}" alt="広告クリエイティブ画像 ${index + 1}" style="max-width: 300px; max-height: 300px; border: 1px solid #ccc; margin: 5px;" />`;
              } catch (err) {
                console.warn(`画像 ${index + 1} のリサイズに失敗しました。元の画像を使用します。`, err);
                fullReportHtml += `<img src="${base64}" alt="広告クリエイティブ画像 ${index + 1}" style="max-width: 300px; max-height: 300px; border: 1px solid #ccc; margin: 5px;" />`;
              }
            }
            fullReportHtml += '</div>';
          }
          
          fullReportHtml += '<hr/>';
        }
      }
      
      // 3. 事実確認サマリー（ステップ3）セクション
      const step3FactBase = getStepData('step3FactBase');
      if (step3FactBase && step3FactBase.trim()) {
        fullReportText += '## 事実確認サマリー（ステップ3）\n\n';
        fullReportText += step3FactBase;
        fullReportText += '\n\n---\n\n';
        
        // Markdownを簡易的にHTMLに変換（基本的な変換のみ）
        const step3Html = step3FactBase
          .replace(/## (.*)/g, '<h2>$1</h2>')
          .replace(/### (.*)/g, '<h3>$1</h3>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\n/g, '<br/>');
        fullReportHtml += '<h2>事実確認サマリー（ステップ3）</h2>' + step3Html + '<hr/>';
      }
      
      // 4. 最終レポート（ステップ4）
      fullReportText += reportText;
      
      // Markdownを簡易的にHTMLに変換
      const reportHtml = reportText
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br/>');
      fullReportHtml += reportHtml;
      
      // HTML形式でクリップボードにコピー（画像を含む）
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          ${fullReportHtml}
        </body>
        </html>
      `;
      
      // Clipboard APIを使用してHTMLとプレーンテキストの両方をコピー
      if (navigator.clipboard && navigator.clipboard.write) {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([fullReportText], { type: 'text/plain' })
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // フォールバック: テキストのみコピー
        await navigator.clipboard.writeText(fullReportText);
      }
      
      setCopyStatus('コピーしました！（画像を含む）');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      // エラー時はテキストのみで再試行
      try {
        const reportText = getStepData('step4FinalReport');
        if (reportText) {
          await navigator.clipboard.writeText(reportText);
          setCopyStatus('コピーしました！（テキストのみ）');
        } else {
          setCopyStatus('コピーに失敗しました。');
        }
      } catch (fallbackErr) {
        setCopyStatus('コピーに失敗しました。');
        console.error('クリップボードへのコピーに失敗:', fallbackErr);
      }
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const handleDownloadDocx = async () => {
    const reportMarkdown = getStepData('step4FinalReport');
    if (!reportMarkdown || !userInput) return;

    setIsDownloading(true);
    try {
        // Prepare ad text based on logic in App.tsx (either finalAdTextForRecheck or combination of CSV/OCR)
        // Since step4FinalReport is available, finalAdTextForRecheck should ideally be populated in parent or we reconstruct.
        // For simplicity, we can pass finalAdTextForRecheck if available, or try to reconstruct.
        // Actually, finalAdTextForRecheck is passed as prop.
        const adText = finalAdTextForRecheck || "広告テキスト情報が見つかりませんでした。";

        await generateWordDocument({
            adText: adText,
            reportMarkdown: reportMarkdown,
            adTextImagesBase64: userInput.adTextImagesBase64,
            adCreativeImagesBase64: userInput.adCreativeImagesBase64
        });
    } catch (error) {
        console.error("Word生成エラー:", error);
        alert("Wordファイルの生成に失敗しました。");
    } finally {
        setIsDownloading(false);
    }
  };

  const renderSimpleContent = (title: string, dataKey: StepKey | StepKey[]) => {
    const keys = Array.isArray(dataKey) ? dataKey : [dataKey];
    const dataArray = keys.map(k => getStepData(k)).filter(d => d !== null && d.trim() !== '');
    if (dataArray.length === 0) return null;

    const content = dataArray.join('\n\n---\n\n');

    return (
      <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
        <h3 className="text-xl font-semibold text-purple-400 mb-3">{title}</h3>
        <pre className="whitespace-pre-wrap break-words text-sm text-slate-300 bg-slate-700/50 p-3 rounded-md shadow leading-relaxed">{content}</pre>
      </div>
    );
  };

  const showStep1 = currentAppStep >= AdCheckStep.ProcessingStep1Step2 && (getStepData('step1CsvText') || getStepData('step1DetectedUrls') || getStepData('step1ClientInfo'));
  const showStep2 = currentAppStep >= AdCheckStep.ProcessingStep1Step2 && (getStepData('step2RawOcrText') || getStepData('step2CorrectedOcrText'));
  const showStep3 = currentAppStep >= AdCheckStep.ProcessingStep3Step4 && getStepData('step3FactBase');
  const showStep4 = currentAppStep === AdCheckStep.Complete && getStepData('step4FinalReport');


  return (
    <div className="mt-6 space-y-6">
      { showStep1 && 
        renderSimpleContent("ステップ1: 抽出された広告テキスト", ['step1CsvText', 'step1DetectedUrls', 'step1ClientInfo'])
      }

      { showStep2 && (
        <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
          <h3 className="text-xl font-semibold text-purple-400 mb-3">ステップ2: OCR結果</h3>
          {currentAppStep === AdCheckStep.OCRVerification || (currentAppStep === AdCheckStep.ReviewStep1Step2 && step2NeedsVerification) ? (
            <>
              <p className="text-yellow-400 mb-2 text-sm">
                OCR処理により、いくつかの曖昧な箇所が特定されました。必要に応じて以下のテキストを確認・修正してください。
                （システムプロンプトでは「[不明箇所1]: 何と記載されていますか？」といった質問形式が指定されていますが、
                このUIでは簡略化のため、下のテキストエリアでOCRテキスト全体を直接編集して修正してください。）
              </p>
              <textarea
                value={editableOcrText}
                onChange={handleOcrTextChange}
                rows={10}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-slate-100 placeholder-slate-400"
                aria-label="編集可能なOCRテキスト"
              />
              <button
                onClick={onOcrVerificationSubmit}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
              >
                OCRテキストを確定
              </button>
            </>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-sm text-slate-300 bg-slate-700/50 p-3 rounded-md shadow leading-relaxed">
                {getStepData('step2CorrectedOcrText') || getStepData('step2RawOcrText')}
            </pre>
          )}
        </div>
      )}

      { currentAppStep === AdCheckStep.ReviewStep1Step2 && !step2NeedsVerification && (
         <button
            onClick={onProceedToFinalProcessing}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition duration-150 ease-in-out text-lg"
          >
            事実確認と最終レポート作成へ進む
        </button>
      )}


      { showStep3 && 
         <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
          <h3 className="text-xl font-semibold text-purple-400 mb-3">ステップ3: 事実確認サマリー</h3>
           <RenderMarkdownReport report={getStepData('step3FactBase')!} />
           
           {/* Grounding Sources Section */}
           {groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
             <div className="mt-6 pt-4 border-t border-slate-600">
               <h4 className="text-sm font-semibold text-slate-400 mb-3">📚 参照されたWebソース (Google Search Grounding)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {groundingMetadata.groundingChunks.map((chunk, idx) => (
                   chunk.web ? (
                     <a 
                       key={idx} 
                       href={chunk.web.uri} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="flex items-center p-2 rounded bg-slate-700 hover:bg-slate-600 transition-colors text-xs text-blue-300 group"
                     >
                       <span className="flex-1 truncate mr-2 font-medium">{chunk.web.title || chunk.web.uri}</span>
                       <span className="text-slate-500 group-hover:text-slate-300">↗</span>
                     </a>
                   ) : null
                 ))}
               </div>
             </div>
           )}
        </div>
      }

      { showStep4 && 
        <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-4 text-center">ステップ4: 最終広告チェックレポート</h2>
          <RenderMarkdownReport report={getStepData('step4FinalReport')!} />
          <div className="mt-6 space-y-4">
            {/* Notion保存案内 */}
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center">
                <span className="mr-2">📝</span>
                Notionデータベースへの保存方法
              </h4>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside ml-2">
                <li>
                  以下のNotionURLを開いてください：
                  <br />
                  <a 
                    href="https://www.notion.so/zeals-ai/2d6d8ab456c080509b25d9bbe6509c7d?v=2d6d8ab456c08028a797000c808b1ca1&source=copy_link" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline break-all"
                  >
                    https://www.notion.so/zeals-ai/2d6d8ab456c080509b25d9bbe6509c7d
                  </a>
                </li>
                <li>そのデータベースで新しいNotionページを作成してください</li>
                <li>「レポートをコピー」ボタンでコピーした内容を、作成したNotionページにペーストしてください</li>
                <li>Notionページのタイトルは、判別がつけば何でも構いません</li>
                <li>ペーストしたら、そのNotionページのURLをセールスフォースの「チェック記録URL」欄に記載してください</li>
              </ol>
            </div>
            
            <div className="text-center flex flex-col sm:flex-row justify-center gap-4">
              <button
                  onClick={handleCopyToClipboard}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded transition duration-150 ease-in-out"
              >
                  レポートをコピー
              </button>
            <button
                onClick={handleDownloadDocx}
                disabled={isDownloading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded transition duration-150 ease-in-out flex items-center justify-center disabled:opacity-50"
            >
                {isDownloading ? (
                    <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成中...
                    </span>
                ) : (
                    "Wordレポートをダウンロード (法務確認用)"
                )}
            </button>
          </div>
          {copyStatus && <p className="text-center text-sm text-green-400 mt-2">{copyStatus}</p>}
          </div>
        </div>
      }
      
      {currentAppStep === AdCheckStep.Error && (
          <p className="text-center text-red-400 font-semibold">エラーが発生しました。上記メッセージおよび部分的な結果を確認してください。</p>
      )}
      {currentAppStep === AdCheckStep.Complete && (
        <>
          <p className="text-center text-green-400 font-semibold text-2xl py-4">🎉 広告チェック処理が正常に完了しました！ 🎉</p>
          {finalAdTextForRecheck && (
            <div className="mt-8 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
              <h3 className="text-xl font-semibold text-amber-400 mb-3">再チェック</h3>
              <p className="text-slate-300 text-sm mb-2">
                現在の結果に対して追加の指示やフィードバックがある場合は、以下に入力して再チェックを実行できます。
                AIはあなたの入力を考慮して、再度評価を行います。
              </p>
              <textarea
                value={recheckPrompt}
                onChange={(e) => setRecheckPrompt(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 text-slate-100 placeholder-slate-400"
                placeholder="例: 「○○の箇所は△△という解釈もできるため問題ないはずです。再検討してください。」"
              />
              <button
                onClick={onRecheck}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out"
              >
                再チェックを実行
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
