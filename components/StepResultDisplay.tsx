
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

// MarkdownテーブルをHTMLテーブルに変換する関数
function convertMarkdownTableToHtml(markdown: string): string {
  const tableData = parseMarkdownTable(markdown);
  if (!tableData || tableData.length === 0) return markdown;

  const headers = Object.keys(tableData[0]);
  let html = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;"><thead><tr>';
  
  // ヘッダー行
  headers.forEach(header => {
    const headerText = convertInlineMarkdown(header);
    html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f2f2f2; font-weight: bold;">${headerText}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  // データ行
  tableData.forEach(row => {
    html += '<tr>';
    headers.forEach(header => {
      const cellText = convertInlineMarkdown(row[header] || '');
      html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${cellText}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  return html;
}

// インラインMarkdown記法をHTMLに変換（太字、斜体、コードなど）
function convertInlineMarkdown(text: string): string {
  if (!text) return '';
  
  // HTMLエスケープを先に実行
  let html = escapeHtml(text);
  
  // インラインコード `code`（先に処理して、他の記法と競合しないようにする）
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px;">$1</code>');
  
  // 太字 **text** または __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // 斜体 *text* または _text_（太字の後に処理、太字でない単一の*や_のみ）
  // 太字でない単一の*を探す（**の前後でないもの）
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
  
  // 改行を<br/>に変換
  html = html.replace(/\n/g, '<br/>');
  
  return html;
}

// HTMLエスケープ関数
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// MarkdownテキストをHTMLに変換（テーブルを含む）
function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  let result = '';
  let currentTableLines: string[] = [];
  let currentParagraph = '';

  function flushParagraph() {
    if (currentParagraph.trim()) {
      let para = convertInlineMarkdown(currentParagraph);
      result += `<p>${para}</p>`;
      currentParagraph = '';
    }
  }

  function flushTable() {
    if (currentTableLines.length > 0) {
      const tableMarkdown = currentTableLines.join('\n');
      result += convertMarkdownTableToHtml(tableMarkdown);
      currentTableLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('## ')) {
      flushParagraph();
      flushTable();
      result += `<h2>${escapeHtml(line.substring(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushTable();
      result += `<h3>${escapeHtml(line.substring(4))}</h3>`;
    } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushParagraph();
      currentTableLines.push(line);
    } else {
      flushTable();
      if (line.trim() === '' && currentParagraph.trim()) {
        flushParagraph();
      } else {
        currentParagraph += (currentParagraph ? '\n' : '') + line;
      }
    }
  }
  
  flushParagraph();
  flushTable();
  
  return result;
}

const RenderMarkdownReport: React.FC<{ report: string }> = React.memo(({ report }) => {
  const elements: React.ReactNode[] = [];
  const lines = report.trim().split('\n');
  let currentTableLines: string[] = [];
  let currentParagraphLines: string[] = [];

      function flushParagraph(keySuffix: string | number) {
    if (currentParagraphLines.length > 0) {
      elements.push(
        <pre key={`p-${keySuffix}-${elements.length}`} className="whitespace-pre-wrap break-words text-sm text-gray-800 bg-gray-50 p-3 rounded-md shadow-sm leading-relaxed mb-3 border border-gray-200">
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
            <table className="min-w-full divide-y divide-gray-200 border border-gray-300 border-collapse text-xs sm:text-sm">
              <thead className="bg-blue-600">
                <tr>
                  {Object.keys(tableData[0]).map((header, hIdx) => (
                    <th key={`${header}-${hIdx}`} scope="col" className="px-3 py-2 text-left font-semibold text-white uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {Object.values(row).map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 whitespace-pre-wrap text-gray-800 break-words">
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
      elements.push(<h2 key={`h2-${i}-${elements.length}`} className="text-2xl font-bold text-gray-900 mt-6 mb-3">{line.substring(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushParagraph(i);
      flushTable(i);
      elements.push(<h3 key={`h3-${i}-${elements.length}`} className="text-xl font-semibold text-blue-600 mt-4 mb-2">{line.substring(4)}</h3>);
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
  
  // 画像をリサイズしてbase64に変換する関数（Notionの制限に対応：テキスト+全画像で500KB~1MB）
  // ファイルサイズ（容量）を直接制御
  const resizeImageForNotion = async (
    base64String: string, 
    totalImages: number = 1,
    targetSizeKB: number = 100 // 1画像あたりの目標サイズ（KB）
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 画像数に応じて目標サイズを調整（全画像で合計500KB~1MBを目指す）
        const adjustedTargetSizeKB = totalImages > 4 ? 50 : totalImages > 2 ? 75 : targetSizeKB;
        const maxSizeBytes = adjustedTargetSizeKB * 1024; // KBをバイトに変換
        
        // 画像数が多い場合、解像度も小さくする
        const maxDimension = totalImages > 4 ? 200 : totalImages > 2 ? 250 : 300;
        
        // アスペクト比を保ちながらリサイズ
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
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
        
        // 品質を段階的に下げながら、目標ファイルサイズに達するまで圧縮
        const tryCompress = (quality: number): string | null => {
          const mimeType = 'image/jpeg';
          const base64 = canvas.toDataURL(mimeType, quality);
          
          // base64のサイズを計算（データ部分のみ）
          const base64Data = base64.split(',')[1];
          const sizeBytes = (base64Data.length * 3) / 4; // base64は約4/3のサイズ
          
          if (sizeBytes <= maxSizeBytes || quality <= 0.1) {
            return base64;
          }
          return null;
        };
        
        // 品質を段階的に下げて試行
        let quality = 0.5;
        let result: string | null = null;
        
        while (quality >= 0.1 && !result) {
          result = tryCompress(quality);
          if (!result) {
            quality -= 0.1;
          }
        }
        
        // それでも大きい場合は、さらに解像度を下げる
        if (!result || (result && ((result.split(',')[1].length * 3) / 4) > maxSizeBytes * 1.5)) {
          // 解像度をさらに下げる
          const smallerDimension = Math.max(150, maxDimension * 0.7);
          const ratio = Math.min(smallerDimension / width, smallerDimension / height);
          width = width * ratio;
          height = height * ratio;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // 低品質で再圧縮
          result = canvas.toDataURL('image/jpeg', 0.2);
        }
        
        resolve(result || canvas.toDataURL('image/jpeg', 0.1));
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
          // 総画像数を計算（リサイズ時の調整に使用）
          const totalImageCount = (userInput.adTextImagesBase64?.length || 0) + (userInput.adCreativeImagesBase64?.length || 0);
          
          fullReportHtml += '<h2>入力画像</h2>';
          
          if (hasAdTextImages) {
            fullReportHtml += '<h3>広告テキスト画像</h3><div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">';
            for (let index = 0; index < userInput.adTextImagesBase64.length; index++) {
              const base64 = userInput.adTextImagesBase64[index];
              try {
                const resizedBase64 = await resizeImageForNotion(base64, totalImageCount);
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
                const resizedBase64 = await resizeImageForNotion(base64, totalImageCount);
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
        
        // MarkdownをHTMLに変換（テーブルを含む）
        const step3Html = convertMarkdownToHtml(step3FactBase);
        fullReportHtml += '<h2>事実確認サマリー（ステップ3）</h2>' + step3Html + '<hr/>';
      }
      
      // 4. 最終レポート（ステップ4）
      fullReportText += reportText;
      
      // MarkdownをHTMLに変換（テーブルを含む）
      const reportHtml = convertMarkdownToHtml(reportText);
      fullReportHtml += reportHtml;
      
      // HTML形式でクリップボードにコピー（画像を含む）
      // Notionに貼り付ける際に表が正しく認識されるように、bodyタグの中身のみを使用
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            img { max-width: 100%; height: auto; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            p { margin: 8px 0; }
            h2 { font-size: 1.5em; font-weight: bold; margin: 16px 0 8px 0; }
            h3 { font-size: 1.2em; font-weight: bold; margin: 12px 0 6px 0; }
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
      <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-3">{title}</h3>
        <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 bg-gray-50 p-3 rounded-md shadow-sm leading-relaxed border border-gray-200">{content}</pre>
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
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">ステップ2: OCR結果</h3>
          {currentAppStep === AdCheckStep.OCRVerification || (currentAppStep === AdCheckStep.ReviewStep1Step2 && step2NeedsVerification) ? (
            <>
              <p className="text-amber-700 mb-2 text-sm font-medium bg-amber-50 p-3 rounded-md border border-amber-200">
                OCR処理により、いくつかの曖昧な箇所が特定されました。必要に応じて以下のテキストを確認・修正してください。
                （システムプロンプトでは「[不明箇所1]: 何と記載されていますか？」といった質問形式が指定されていますが、
                このUIでは簡略化のため、下のテキストエリアでOCRテキスト全体を直接編集して修正してください。）
              </p>
              <textarea
                value={editableOcrText}
                onChange={handleOcrTextChange}
                rows={10}
                className="w-full p-3 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                aria-label="編集可能なOCRテキスト"
              />
              <button
                onClick={onOcrVerificationSubmit}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-150 ease-in-out shadow-sm hover:shadow-md"
              >
                OCRテキストを確定
              </button>
            </>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 bg-gray-50 p-3 rounded-md shadow-sm leading-relaxed border border-gray-200">
                {getStepData('step2CorrectedOcrText') || getStepData('step2RawOcrText')}
            </pre>
          )}
        </div>
      )}

      { currentAppStep === AdCheckStep.ReviewStep1Step2 && !step2NeedsVerification && (
         <button
            onClick={onProceedToFinalProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out text-lg shadow-sm hover:shadow-md"
          >
            事実確認と最終レポート作成へ進む
        </button>
      )}


      { showStep3 && 
         <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-3">ステップ3: 事実確認サマリー</h3>
           <RenderMarkdownReport report={getStepData('step3FactBase')!} />
           
           {/* Grounding Sources Section */}
           {groundingMetadata && groundingMetadata.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
             <div className="mt-6 pt-4 border-t border-gray-300">
               <h4 className="text-sm font-semibold text-gray-700 mb-3">📚 参照されたWebソース (Google Search Grounding)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                 {groundingMetadata.groundingChunks.map((chunk, idx) => (
                   chunk.web ? (
                     <a 
                       key={idx} 
                       href={chunk.web.uri} 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       className="flex items-center p-2 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors text-xs text-blue-700 group border border-blue-200 shadow-sm"
                     >
                       <span className="flex-1 truncate mr-2 font-medium">{chunk.web.title || chunk.web.uri}</span>
                       <span className="text-blue-600 group-hover:text-blue-800">↗</span>
                     </a>
                   ) : null
                 ))}
               </div>
             </div>
           )}
        </div>
      }

      { showStep4 && 
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">ステップ4: 最終広告チェックレポート</h2>
          <RenderMarkdownReport report={getStepData('step4FinalReport')!} />
          <div className="mt-6 space-y-4">
            {/* Notion保存案内 */}
            <div className="bg-blue-50 border-l-4 border-blue-600 rounded-md p-4 mb-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                <span className="mr-2">📝</span>
                Notionデータベースへの保存方法
              </h4>
              <ol className="text-xs text-gray-700 space-y-2 list-decimal list-inside ml-2">
                <li>
                  以下のNotionURLを開いてください：
                  <br />
                  <a 
                    href="https://www.notion.so/zeals-ai/2d6d8ab456c080509b25d9bbe6509c7d?v=2d6d8ab456c08028a797000c808b1ca1&source=copy_link" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline break-all font-semibold"
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
                  className="bg-white hover:bg-gray-50 text-blue-600 font-bold py-2 px-6 rounded-lg transition duration-150 ease-in-out border-2 border-blue-600 shadow-sm hover:shadow-md"
              >
                  レポートをコピー
              </button>
            <button
                onClick={handleDownloadDocx}
                disabled={isDownloading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-150 ease-in-out flex items-center justify-center disabled:opacity-50 shadow-sm hover:shadow-md"
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
          {copyStatus && <p className="text-center text-sm text-green-700 mt-2 font-semibold">{copyStatus}</p>}
          </div>
        </div>
      }
      
      {currentAppStep === AdCheckStep.Error && (
          <p className="text-center text-red-700 font-semibold bg-red-50 p-3 rounded-md border border-red-200">エラーが発生しました。上記メッセージおよび部分的な結果を確認してください。</p>
      )}
      {currentAppStep === AdCheckStep.Complete && (
        <>
          <p className="text-center text-green-700 font-semibold text-2xl py-4 bg-green-50 p-4 rounded-lg border border-green-200">🎉 広告チェック処理が正常に完了しました！ 🎉</p>
          {finalAdTextForRecheck && (
            <div className="mt-8 p-4 border border-gray-300 rounded-lg bg-white shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">再チェック</h3>
              <p className="text-gray-700 text-sm mb-2 font-medium">
                現在の結果に対して追加の指示やフィードバックがある場合は、以下に入力して再チェックを実行できます。
                AIはあなたの入力を考慮して、再度評価を行います。
              </p>
              <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-sm text-gray-700 mb-2 font-semibold">入力例:</p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                  <li>「○○の箇所は△△という解釈もできるため問題ないはずです。再検討してください。」</li>
                  <li>「最初に〇〇というクライアントからもらった非公開情報を入れ忘れてしまったのでそれを考慮して」</li>
                </ul>
              </div>
              <textarea
                value={recheckPrompt}
                onChange={(e) => setRecheckPrompt(e.target.value)}
                rows={4}
                className="w-full p-3 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                placeholder="例: 「○○の箇所は△△という解釈もできるため問題ないはずです。再検討してください。」\n例: 「最初に〇〇というクライアントからもらった非公開情報を入れ忘れてしまったのでそれを考慮して」"
              />
              <button
                onClick={onRecheck}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-150 ease-in-out shadow-sm hover:shadow-md"
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
