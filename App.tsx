
import React, { useState, useCallback } from 'react';
import { InputForm } from './components/InputForm';
import { Stepper } from './components/Stepper';
import { StepResultDisplay } from './components/StepResultDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AdCheckInput, AdCheckStep, StepKey, OCRVerificationItem, GroundingMetadata } from './types';
import { geminiService } from './services/geminiService';
import { MAIN_SYSTEM_PROMPT, KNOWLEDGE_BASE_1_REQUIRED_OUTPUT, KNOWLEDGE_BASE_2_LINE_GUIDELINES, KNOWLEDGE_BASE_3_BASIC_AD_RULES, KNOWLEDGE_BASE_4_FINANCIAL_LOAN_RULES, KNOWLEDGE_BASE_5_COSMETICS_RULES, KNOWLEDGE_BASE_6_MEDICAL_RULES } from './constants';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AdCheckStep>(AdCheckStep.Input);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [userInput, setUserInput] = useState<AdCheckInput | null>(null);
  
  const [step1CsvText, setStep1CsvText] = useState<string | null>(null);
  const [step1DetectedUrls, setStep1DetectedUrls] = useState<string | null>(null);
  const [step1ClientInfo, setStep1ClientInfo] = useState<string | null>(null);

  const [step2RawOcrText, setStep2RawOcrText] = useState<string | null>(null);
  const [step2NeedsVerification, setStep2NeedsVerification] = useState<boolean>(false);
  const [step2VerificationItems, setStep2VerificationItems] = useState<OCRVerificationItem[]>([]); // Keep for future detailed verification
  const [step2CorrectedOcrText, setStep2CorrectedOcrText] = useState<string | null>(null);
  
  const [finalAdText, setFinalAdText] = useState<string | null>(null);

  const [step3FactBase, setStep3FactBase] = useState<string | null>(null);
  const [step3GroundingMetadata, setStep3GroundingMetadata] = useState<GroundingMetadata | null>(null);
  const [step4FinalReport, setStep4FinalReport] = useState<string | null>(null);

  const [recheckPrompt, setRecheckPrompt] = useState<string>('');

  const KNOWN_CSV_ERROR_MESSAGE = "システムからのCSVテキスト部分の解析に失敗しました。";
  const KNOWN_OCR_ERROR_MESSAGE = "システムからのOCRテキスト部分の解析に失敗しました。";
  const KNOWN_OCR_NO_IMAGE_MESSAGE = "OCR対象の画像はありませんでした。";


  const resetState = (isFullReset: boolean = true) => {
    if (isFullReset) {
      setUserInput(null);
      setStep1CsvText(null);
      setStep1DetectedUrls(null);
      setStep1ClientInfo(null);
      setFinalAdText(null);
    }
    // Common reset for both full and re-check scenarios
    setCurrentStep(isFullReset ? AdCheckStep.Input : AdCheckStep.ProcessingStep3Step4); // Go to input or back to processing for re-check
    setIsLoading(false);
    setErrorMessage(null);
    setStep2RawOcrText(null);
    setStep2NeedsVerification(false);
    setStep2VerificationItems([]);
    setStep2CorrectedOcrText(null);
    setStep3FactBase(null);
    setStep3GroundingMetadata(null);
    setStep4FinalReport(null);
    setRecheckPrompt('');
  };
  
  const parseGeminiStage1Response = (responseText: string, isCsvInput: boolean, hasDirectTextInput: boolean) => {
    const csvTextMatch = responseText.match(/===== CSV_TEXT_START =====\s*([\s\S]*?)\s*===== CSV_TEXT_END =====/);
    setStep1CsvText(csvTextMatch ? csvTextMatch[1].trim() : KNOWN_CSV_ERROR_MESSAGE);

    if (hasDirectTextInput && !isCsvInput) { 
        const urlsMatch = responseText.match(/🔗 検出されたURL:\s*([\s\S]*?)(?=\n\n📝|\n✅ STEP1 完了)/);
        setStep1DetectedUrls(urlsMatch ? urlsMatch[1].trim() : "URLは検出されませんでした、または解析に失敗しました。");
        
        const clientInfoMatch = responseText.match(/📝 検出されたクライアント共有情報:\s*([\s\S]*?)(?=\n✅ STEP1 完了)/);
        setStep1ClientInfo(clientInfoMatch ? clientInfoMatch[1].trim() : "クライアント共有情報は検出されませんでした、または解析に失敗しました。");
    } else {
        setStep1DetectedUrls(null);
        setStep1ClientInfo(null);
    }

    const ocrTextMatch = responseText.match(/===== OCR_TEXT_START =====\s*([\s\S]*?)\s*===== OCR_TEXT_END =====/);
    let rawOcr = ocrTextMatch ? ocrTextMatch[1].trim() : KNOWN_OCR_ERROR_MESSAGE;
    // Gemini may return "OCR対象の画像はありませんでした。" if no images were sent, per prompt.
    // This is a valid state, not an error in OCR parsing itself for this check.
    if (ocrTextMatch && ocrTextMatch[1].trim() === KNOWN_OCR_NO_IMAGE_MESSAGE) {
        rawOcr = KNOWN_OCR_NO_IMAGE_MESSAGE;
    }
    
    setStep2RawOcrText(rawOcr);
    setStep2CorrectedOcrText(rawOcr); 

    const verificationNeededMatch = responseText.match(/⚠️ OCR確認が必要な場合:\s*([\s\S]*?)(?=\n\n正確な文字をお教えいただければ|\n✅ STEP2 完了|\n--- 内部統合処理)/);
    if (verificationNeededMatch && verificationNeededMatch[1].includes("何と記載されていますか？") && rawOcr !== KNOWN_OCR_NO_IMAGE_MESSAGE && rawOcr !== KNOWN_OCR_ERROR_MESSAGE) {
        setStep2NeedsVerification(true);
        const questions = verificationNeededMatch[1].trim().split('\n').filter(line => line.includes("何と記載されていますか？"));
        const items: OCRVerificationItem[] = questions.map((q, index) => ({
            id: String(index),
            question: q,
            answer: ''
        }));
        setStep2VerificationItems(items);
        setCurrentStep(AdCheckStep.OCRVerification);
    } else {
        setStep2NeedsVerification(false);
        setCurrentStep(AdCheckStep.ReviewStep1Step2);
    }
  };

  const handleStartCheck = useCallback(async (data: AdCheckInput) => {
    resetState(); 
    setUserInput(data);
    setIsLoading(true);
    setErrorMessage(null);
    setCurrentStep(AdCheckStep.ProcessingStep1Step2);

    try {
      const stage1Response = await geminiService.runStage1_AdTextAndOCR({
        mainSystemPrompt: MAIN_SYSTEM_PROMPT,
        adTextCsvFileContent: data.adTextCsvFileContent,
        adTextDirect: data.adTextDirect,
        adTextImagesBase64: data.adTextImagesBase64,
        adCreativeImagesBase64: data.adCreativeImagesBase64,
        isCsvInput: !!data.adTextCsvFileContent,
        hasDirectTextInput: !!data.adTextDirect.trim(),
      });
      
      parseGeminiStage1Response(stage1Response.text, !!data.adTextCsvFileContent, !!data.adTextDirect.trim());

    } catch (error) {
      console.error("ステージ1でのエラー:", error);
      setErrorMessage(`広告テキスト/OCR処理中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      setCurrentStep(AdCheckStep.Error as any);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOcrVerificationComplete = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    setStep2NeedsVerification(false); 
    setCurrentStep(AdCheckStep.ReviewStep1Step2); 
    setIsLoading(false);
  }, []);

  const proceedToFinalProcessing = useCallback(async (isRecheck: boolean = false) => {
    if (!userInput) {
        setErrorMessage("ユーザー入力が見つかりません。");
        setCurrentStep(AdCheckStep.Error as any);
        return;
    }

    const hasActualCsvText = step1CsvText && step1CsvText.trim() && step1CsvText !== KNOWN_CSV_ERROR_MESSAGE;
    
    const hasActualOcrText = step2CorrectedOcrText && 
                             step2CorrectedOcrText.trim() && 
                             step2CorrectedOcrText !== KNOWN_OCR_ERROR_MESSAGE &&
                             step2CorrectedOcrText !== KNOWN_OCR_NO_IMAGE_MESSAGE;

    if (!isRecheck && !hasActualCsvText && !hasActualOcrText) {
        setErrorMessage("広告テキストが直接入力、CSV、または画像OCRのいずれの方法でも提供されていないか、有効なテキストの解析に失敗しました。処理を続行できません。");
        setCurrentStep(AdCheckStep.Error as any);
        return;
    }
    
    if (isRecheck && !finalAdText) {
        setErrorMessage("再チェックのための既存の広告テキストが見つかりません。");
        setCurrentStep(AdCheckStep.Error as any);
        return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCurrentStep(AdCheckStep.ProcessingStep3Step4);

    let ad_text_for_gemini: string;
    if (isRecheck && finalAdText) {
        ad_text_for_gemini = finalAdText;
    } else {
        const combinedLines = [];
        if (hasActualCsvText && step1CsvText) {
            combinedLines.push(...step1CsvText.split('\n'));
        }
        if (hasActualOcrText && step2CorrectedOcrText) {
            combinedLines.push(...step2CorrectedOcrText.split('\n'));
        }
        
        const uniqueLines = Array.from(new Set(combinedLines.map(line => line.trim()).filter(line => line !== '')));
        ad_text_for_gemini = uniqueLines.join('\n');

        if (!ad_text_for_gemini.trim() && !isRecheck) {
            setErrorMessage("処理可能な有効な広告テキストがありません。入力内容を確認してください。");
            setCurrentStep(AdCheckStep.Error as any);
            setIsLoading(false);
            return;
        }
        setFinalAdText(ad_text_for_gemini);
    }
    
    try {
        const stage2Response = await geminiService.runStage2_FactFindAndReport({
            mainSystemPrompt: MAIN_SYSTEM_PROMPT,
            knowledgeBase1: KNOWLEDGE_BASE_1_REQUIRED_OUTPUT,
            knowledgeBase2: KNOWLEDGE_BASE_2_LINE_GUIDELINES,
            knowledgeBase3: KNOWLEDGE_BASE_3_BASIC_AD_RULES,
            knowledgeBase4: KNOWLEDGE_BASE_4_FINANCIAL_LOAN_RULES,
            knowledgeBase5: KNOWLEDGE_BASE_5_COSMETICS_RULES,
            knowledgeBase6: KNOWLEDGE_BASE_6_MEDICAL_RULES,
            finalAdText: ad_text_for_gemini,
            referenceUrls: userInput.referenceUrls,
            clientSharedInfo: userInput.clientSharedInfo,
            recheckPrompt: isRecheck ? recheckPrompt : null,
            // Pass images directly for visual checking in Stage 2
            adTextImagesBase64: userInput.adTextImagesBase64,
            adCreativeImagesBase64: userInput.adCreativeImagesBase64
        });

        const responseText = stage2Response.text;
        
        const step3Match = responseText.match(/===== CLIENT_SHARED_INFO_SUMMARY =====\s*([\s\S]*?)\s*===== FACT_BASE_END =====/);
        setStep3FactBase(step3Match ? step3Match[0].trim() : "システムからのステップ3結果の解析に失敗しました。");
        setStep3GroundingMetadata(stage2Response.groundingMetadata || null);

        const step4Match = responseText.match(/## 1\. 認識した広告内容\s*([\s\S]*?)(?=🎉 Zeals 会話型広告 Wチェック完了|$)/);
        let finalReportContent = step4Match ? step4Match[0].trim() : "システムからのステップ4最終レポートの解析に失敗しました。";

        if (isRecheck && recheckPrompt.trim() !== '') {
            const userFeedbackSection = `## ユーザーフィードバックに基づく再チェック\n\n以下のフィードバックを考慮して再評価を行いました：\n\`\`\`\n${recheckPrompt.trim()}\n\`\`\`\n\n--- 再チェック結果 ---\n\n`;
            finalReportContent = userFeedbackSection + finalReportContent;
        }
        setStep4FinalReport(finalReportContent);
        
        setCurrentStep(AdCheckStep.Complete);

    } catch (error) {
        console.error("ステージ2でのエラー:", error);
        setErrorMessage(`事実情報取得/レポート生成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        setCurrentStep(AdCheckStep.Error as any);
    } finally {
        setIsLoading(false);
    }
  }, [userInput, step1CsvText, step2CorrectedOcrText, finalAdText, recheckPrompt]);

  const handleRecheck = useCallback(() => {
    if (!recheckPrompt.trim()) {
      alert("再チェックのための指示・フィードバックを入力してください。");
      return;
    }
    setStep3FactBase(null);
    setStep3GroundingMetadata(null);
    setStep4FinalReport(null);
    setErrorMessage(null);
    setCurrentStep(AdCheckStep.ProcessingStep3Step4); 
    proceedToFinalProcessing(true); 
  }, [recheckPrompt, proceedToFinalProcessing]);


  const getStepData = (stepKey: StepKey): string | null => {
    switch(stepKey) {
        case 'step1CsvText': return step1CsvText;
        case 'step1DetectedUrls': return step1DetectedUrls;
        case 'step1ClientInfo': return step1ClientInfo;
        case 'step2RawOcrText': return step2RawOcrText;
        case 'step2CorrectedOcrText': return step2CorrectedOcrText;
        case 'step3FactBase': return step3FactBase;
        case 'step4FinalReport': return step4FinalReport;
        default: return null;
    }
  };
  
  const updateStepData = (stepKey: StepKey, value: string) => {
    if (stepKey === 'step2CorrectedOcrText') {
        setStep2CorrectedOcrText(value);
    }
  };


  return (
    <div className="min-h-screen container mx-auto p-4 flex flex-col items-center">
      <header className="w-full mb-8 text-center">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          AI広告リーガルチェックツール
        </h1>
        <p className="text-slate-400 mt-2">広告の法的およびコンプライアンスレビューを自動化します。</p>
        <div className="mt-3">
          <a 
            href="https://www.notion.so/zeals-ai/AI-Ver2-2afd8ab456c081359572e583800c7b84"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline text-sm flex items-center justify-center gap-1 transition-colors"
          >
            <span>📖</span> AIチェックマニュアルはこちら (Notion)
          </a>
        </div>
      </header>

      {isLoading && <LoadingSpinner />}

      <main className="w-full max-w-4xl bg-slate-800 shadow-2xl rounded-lg p-6">
        <Stepper currentStep={currentStep} />

        {errorMessage && (
          <div className="bg-red-700 border border-red-900 text-red-100 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">エラー: </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {currentStep === AdCheckStep.Input && (
          <InputForm onSubmit={handleStartCheck} isLoading={isLoading} />
        )}
        
        { (currentStep >= AdCheckStep.ProcessingStep1Step2 && currentStep !== AdCheckStep.Input ) && (
          <StepResultDisplay
            currentAppStep={currentStep}
            getStepData={getStepData}
            updateStepData={updateStepData}
            step2NeedsVerification={step2NeedsVerification}
            onOcrVerificationSubmit={handleOcrVerificationComplete}
            onProceedToFinalProcessing={() => proceedToFinalProcessing(false)}
            onRecheck={handleRecheck}
            recheckPrompt={recheckPrompt}
            setRecheckPrompt={setRecheckPrompt}
            finalAdTextForRecheck={finalAdText}
            groundingMetadata={step3GroundingMetadata}
            userInput={userInput} // 画像データをレポートに含めるためにuserInputを渡す
          />
        )}
         {currentStep !== AdCheckStep.Input && (
            <button
                onClick={() => resetState(true)}
                className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full"
            >
                新しいチェックを開始
            </button>
        )}
      </main>
      <footer className="w-full text-center mt-12 pb-8 text-slate-500">
        <p>&copy; {new Date().getFullYear()} AI広告リーガルチェックツール. Powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;
