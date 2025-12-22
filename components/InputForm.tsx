
import React, { useState, useCallback } from 'react';
import { AdCheckInput, MAX_AD_TEXT_IMAGES, MAX_AD_CREATIVE_IMAGES } from '../types';

interface InputFormProps {
  onSubmit: (data: AdCheckInput) => void;
  isLoading: boolean;
}

type AdTextSourceType = 'direct' | 'csv';

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
  const [adTextSource, setAdTextSource] = useState<AdTextSourceType>('direct');
  const [adTextDirect, setAdTextDirect] = useState<string>('');
  const [adTextCsvFile, setAdTextCsvFile] = useState<File | null>(null);
  const [adTextCsvFileContent, setAdTextCsvFileContent] = useState<string | null>(null);
  
  const [adTextImages, setAdTextImages] = useState<File[]>([]);
  const [adTextImagesBase64, setAdTextImagesBase64] = useState<string[]>([]);
  const [adTextImagePreviews, setAdTextImagePreviews] = useState<string[]>([]);

  const [adCreativeImageFiles, setAdCreativeImageFiles] = useState<File[]>([]);
  const [adCreativeImagesBase64, setAdCreativeImagesBase64] = useState<string[]>([]);
  const [adCreativeImagePreviews, setAdCreativeImagePreviews] = useState<string[]>([]);
  
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [newReferenceUrl, setNewReferenceUrl] = useState<string>('');
  const [clientSharedInfo, setClientSharedInfo] = useState<string>('');
  
  const MAX_REFERENCE_URLS = 20; // URL contextツールの制限に合わせて20個まで
  
  const [csvFileName, setCsvFileName] = useState<string>('');

  const handleAdTextSourceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAdTextSource(event.target.value as AdTextSourceType);
    // Reset other source when switching
    if (event.target.value === 'direct') {
        setAdTextCsvFile(null);
        setAdTextCsvFileContent(null);
        setCsvFileName('');
    } else {
        setAdTextDirect('');
    }
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAdTextCsvFile(file);
      setCsvFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAdTextCsvFileContent(e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      setAdTextCsvFile(null);
      setAdTextCsvFileContent(null);
      setCsvFileName('');
    }
  };

  const handleAdTextImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const selectedFiles = Array.from(files).slice(0, MAX_AD_TEXT_IMAGES - adTextImages.length);
      const newFiles = [...adTextImages, ...selectedFiles].slice(0, MAX_AD_TEXT_IMAGES);
      setAdTextImages(newFiles);
      
      const newBase64Strings: string[] = [];
      const newPreviews: string[] = [];
      let filesProcessed = 0;

      if (newFiles.length === 0) {
        setAdTextImagesBase64([]);
        setAdTextImagePreviews([]);
        return;
      }
      
      newFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            newBase64Strings.push(reader.result as string);
            newPreviews.push(reader.result as string);
            filesProcessed++;
            if (filesProcessed === newFiles.length) {
              setAdTextImagesBase64(newBase64Strings);
              setAdTextImagePreviews(newPreviews);
            }
          };
          reader.readAsDataURL(file);
        } else {
            alert("画像ファイルのみアップロードしてください (PNG, JPG など).");
            filesProcessed++;
             if (filesProcessed === newFiles.length && newBase64Strings.length === 0 && newPreviews.length === 0) {
                setAdTextImagesBase64([]);
                setAdTextImagePreviews([]);
            }
        }
      });
    }
  };
  
  const removeAdTextImage = (index: number) => {
    setAdTextImages(prev => prev.filter((_, i) => i !== index));
    setAdTextImagesBase64(prev => prev.filter((_, i) => i !== index));
    setAdTextImagePreviews(prev => prev.filter((_, i) => i !== index));
  };


  const handleCreativeImageFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
        const selectedFiles = Array.from(files).slice(0, MAX_AD_CREATIVE_IMAGES - adCreativeImageFiles.length);
        const newFiles = [...adCreativeImageFiles, ...selectedFiles].slice(0, MAX_AD_CREATIVE_IMAGES);
        setAdCreativeImageFiles(newFiles);

        const newBase64Strings: string[] = [];
        const newPreviews: string[] = [];
        let filesProcessed = 0;

        if (newFiles.length === 0) {
            setAdCreativeImagesBase64([]);
            setAdCreativeImagePreviews([]);
            return;
        }

        newFiles.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    newBase64Strings.push(reader.result as string);
                    newPreviews.push(reader.result as string);
                    filesProcessed++;
                    if (filesProcessed === newFiles.length) {
                        setAdCreativeImagesBase64(newBase64Strings);
                        setAdCreativeImagePreviews(newPreviews);
                    }
                };
                reader.readAsDataURL(file);
            } else {
                alert("有効な画像ファイルをアップロードしてください (PNG, JPG など).");
                filesProcessed++;
                if (filesProcessed === newFiles.length && newBase64Strings.length === 0 && newPreviews.length === 0) {
                    setAdCreativeImagesBase64([]);
                    setAdCreativeImagePreviews([]);
                }
            }
        });
    }
  };

  const removeCreativeImage = (index: number) => {
    setAdCreativeImageFiles(prev => prev.filter((_, i) => i !== index));
    setAdCreativeImagesBase64(prev => prev.filter((_, i) => i !== index));
    setAdCreativeImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addReferenceUrl = () => {
    const trimmedUrl = newReferenceUrl.trim();
    if (!trimmedUrl) return;
    
    // URL形式の検証
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      alert('URLは http:// または https:// で始まる必要があります。');
      return;
    }
    
    if (referenceUrls.length >= MAX_REFERENCE_URLS) {
      alert(`参照URLは最大${MAX_REFERENCE_URLS}個まで入力できます。`);
      return;
    }
    
    if (referenceUrls.includes(trimmedUrl)) {
      alert('このURLは既に追加されています。');
      return;
    }
    
    setReferenceUrls(prev => [...prev, trimmedUrl]);
    setNewReferenceUrl('');
  };

  const removeReferenceUrl = (index: number) => {
    setReferenceUrls(prev => prev.filter((_, i) => i !== index));
  };


  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const isDirectTextProvided = adTextSource === 'direct' && adTextDirect.trim() !== '';
    const isCsvFileProvided = adTextSource === 'csv' && adTextCsvFileContent;
    const isAdTextImagesProvided = adTextImagesBase64.length > 0;
    const isCreativeImagesProvided = adCreativeImagesBase64.length > 0;
    const isUrlProvided = referenceUrls.length > 0;
    const isClientInfoProvided = clientSharedInfo.trim() !== '';

    // 入力チェック: 少なくとも何らかの情報が入力されていること
    if (!isDirectTextProvided && !isCsvFileProvided && !isAdTextImagesProvided && !isCreativeImagesProvided && !isUrlProvided && !isClientInfoProvided) {
        alert("チェックを行うための情報を少なくとも1つ入力してください（広告テキスト、画像、URL、またはクライアント共有情報）。");
        return;
    }

    onSubmit({
      adTextDirect: isDirectTextProvided ? adTextDirect : '',
      adTextCsvFileContent: isCsvFileProvided ? adTextCsvFileContent : null,
      adTextImagesBase64: isAdTextImagesProvided ? adTextImagesBase64 : null,
      adCreativeImagesBase64: adCreativeImagesBase64.length > 0 ? adCreativeImagesBase64 : null,
      referenceUrls: referenceUrls.join(','),
      clientSharedInfo,
    });
  }, [onSubmit, adTextSource, adTextDirect, adTextCsvFileContent, adTextImagesBase64, adCreativeImagesBase64, referenceUrls, clientSharedInfo, newReferenceUrl]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          広告テキスト入力方法を選択
        </label>
        <div className="flex items-center space-x-4 mb-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="adTextSource"
              value="direct"
              checked={adTextSource === 'direct'}
              onChange={handleAdTextSourceChange}
              className="form-radio h-4 w-4 text-purple-600 bg-slate-700 border-slate-600 focus:ring-purple-500"
            />
            <span className="text-slate-300">直接入力</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="adTextSource"
              value="csv"
              checked={adTextSource === 'csv'}
              onChange={handleAdTextSourceChange}
              className="form-radio h-4 w-4 text-purple-600 bg-slate-700 border-slate-600 focus:ring-purple-500"
            />
            <span className="text-slate-300">CSVファイル</span>
          </label>
        </div>

        {adTextSource === 'direct' && (
          <div>
            <label htmlFor="adTextDirect" className="block text-sm font-medium text-slate-300 mb-1">
              広告テキスト (直接入力)
            </label>
            <textarea
              id="adTextDirect"
              value={adTextDirect}
              onChange={(e) => setAdTextDirect(e.target.value)}
              rows={5}
              className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-slate-100 placeholder-slate-400"
              placeholder="広告テキスト、URL、クライアント共有情報をここに入力します。"
            />
          </div>
        )}

        {adTextSource === 'csv' && (
          <div>
            <label htmlFor="adTextCsvFile" className="block text-sm font-medium text-slate-300 mb-1">
              広告テキスト (CSVファイル)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-slate-500">
                  <label htmlFor="adTextCsvFile" className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-purple-400 hover:text-purple-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-purple-500 px-1">
                    <span>ファイルをアップロード</span>
                    <input id="adTextCsvFile" name="adTextCsvFile" type="file" className="sr-only" accept=".csv" onChange={handleCsvFileChange} />
                  </label>
                  <p className="pl-1">またはドラッグ＆ドロップ</p>
                </div>
                <p className="text-xs text-slate-600">CSV 最大10MB</p>
                {csvFileName && <p className="text-sm text-slate-400 mt-2">選択中: {csvFileName}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div>
        <label htmlFor="adTextImages" className="block text-sm font-medium text-slate-300 mb-1">
          広告テキスト画像 (スクリーンショット等、最大{MAX_AD_TEXT_IMAGES}枚)
        </label>
        <input
          id="adTextImages"
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp"
          onChange={handleAdTextImagesChange}
          className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          disabled={adTextImages.length >= MAX_AD_TEXT_IMAGES}
        />
        {adTextImagePreviews.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 border border-slate-600 p-2 rounded-md">
            {adTextImagePreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img src={preview} alt={`広告テキスト画像プレビュー ${index + 1}`} className="h-24 w-auto object-contain border border-slate-500 rounded"/>
                <button
                  type="button"
                  onClick={() => removeAdTextImage(index)}
                  className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 text-xs leading-none hover:bg-red-700"
                  aria-label={`広告テキスト画像 ${index + 1} を削除`}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-slate-700 my-4" />

      <div>
        <label htmlFor="adCreativeImageFiles" className="block text-sm font-medium text-slate-300 mb-1">
          広告クリエイティブ画像 (PNG, JPGなど、最大{MAX_AD_CREATIVE_IMAGES}枚)
        </label>
        <input
          id="adCreativeImageFiles"
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp"
          onChange={handleCreativeImageFilesChange}
          className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
          disabled={adCreativeImageFiles.length >= MAX_AD_CREATIVE_IMAGES}
        />
        {adCreativeImagePreviews.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 border border-slate-600 p-2 rounded-md">
                {adCreativeImagePreviews.map((preview, index) => (
                    <div key={`creative-${index}`} className="relative">
                        <img src={preview} alt={`広告クリエイティブプレビュー ${index + 1}`} className="h-24 w-auto object-contain border border-slate-500 rounded"/>
                        <button
                          type="button"
                          onClick={() => removeCreativeImage(index)}
                          className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 text-xs leading-none hover:bg-red-700"
                          aria-label={`広告クリエイティブ画像 ${index + 1} を削除`}
                        >
                            X
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>

      <div>
        <label htmlFor="referenceUrls" className="block text-sm font-medium text-slate-300 mb-1">
          参照URL (最大{MAX_REFERENCE_URLS}個)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newReferenceUrl}
            onChange={(e) => setNewReferenceUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addReferenceUrl();
              }
            }}
            placeholder="https://example.com/product"
            className="flex-1 p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-slate-100 placeholder-slate-400"
            disabled={referenceUrls.length >= MAX_REFERENCE_URLS}
          />
          <button
            type="button"
            onClick={addReferenceUrl}
            disabled={referenceUrls.length >= MAX_REFERENCE_URLS || !newReferenceUrl.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-md transition duration-150 ease-in-out"
          >
            追加
          </button>
        </div>
        {referenceUrls.length > 0 && (
          <div className="mt-2 space-y-2">
            {referenceUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-slate-700 border border-slate-600 rounded-md">
                <span className="flex-1 text-sm text-slate-200 break-all">{url}</span>
                <button
                  type="button"
                  onClick={() => removeReferenceUrl(index)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition duration-150 ease-in-out"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
        {referenceUrls.length >= MAX_REFERENCE_URLS && (
          <p className="mt-2 text-sm text-yellow-400">
            最大{MAX_REFERENCE_URLS}個まで入力できます（URL contextツールの制限に合わせています）
          </p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="clientSharedInfo" className="block text-sm font-medium text-slate-300">
            クライアント共有情報・Web非公開情報 (任意)
          </label>
        </div>
        <div className="mb-2 text-xs">
          <a 
            href="https://www.notion.so/zeals-ai/AI-Ver2-2afd8ab456c081359572e583800c7b84?source=copy_link#2b9d8ab456c0806ebcc5e8943b653cd0" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-purple-400 hover:text-purple-300 underline flex items-center"
          >
            <span className="mr-1">💡</span>
            Webに載っていない情報のテキスト化方法はこちら(Notion)
          </a>
        </div>
        <textarea
          id="clientSharedInfo"
          value={clientSharedInfo}
          onChange={(e) => setClientSharedInfo(e.target.value)}
          rows={4}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-slate-100 placeholder-slate-400"
          placeholder="クライアントからの補足情報や、Webに掲載されていない情報をここに入力してください。"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-purple-500 disabled:opacity-50 transition-colors"
      >
        {isLoading ? '処理中...' : '広告チェックを開始'}
      </button>
    </form>
  );
};
