
export interface AdCheckInput {
  adTextDirect: string;
  adTextCsvFileContent: string | null; // Content of the CSV file as a string
  adTextImagesBase64: string[] | null; // Base64 encoded ad text screenshot strings
  adCreativeImagesBase64: string[] | null; // Array of Base64 encoded ad creative image strings
  referenceUrls: string;
  clientSharedInfo: string;
}

export enum AdCheckStep {
  Input = 0,                  // 入力画面
  ProcessingStep1Step2 = 1, // ステップ1(広告テキスト抽出)＆ステップ2(OCR)処理中
  OCRVerification = 2,      // OCR結果のユーザー確認・修正中
  ReviewStep1Step2 = 3,     // ステップ1＆2の結果レビュー、最終処理へ進む前
  ProcessingStep3Step4 = 4, // ステップ3(事実情報取得)＆ステップ4(レポート生成)処理中
  Complete = 5,               // 全ステップ完了
  Error = 6,                  // エラー発生
}

export interface OCRVerificationItem {
  id: string; // Changed to string to resolve type assignment error
  question: string; // The question from Gemini, e.g., "画像1の不明瞭な箇所は何と記載されていますか？"
  answer: string;   // User's answer for that specific question (currently not used directly if user edits main textarea)
  // Optional: imageName or imageId if we need to link questions to specific images more directly in the future
}

export interface GeminiStage1Response {
  text: string; 
  // We will parse csv_text, ocr_text, and verification needs from this text
}

export interface WebSource {
  uri: string;
  title: string;
}

export interface GroundingMetadata {
  groundingChunks?: {
    web?: WebSource;
  }[];
}

export interface GeminiStage2Response {
  text: string;
  groundingMetadata?: GroundingMetadata;
  // We will parse step3_summary and step4_final_report from this text
}

export type StepKey = 
  | 'step1CsvText' 
  | 'step1DetectedUrls'
  | 'step1ClientInfo'
  | 'step2RawOcrText' 
  | 'step2CorrectedOcrText'
  | 'step3FactBase'
  | 'step4FinalReport';

export const MAX_AD_TEXT_IMAGES = 8;
export const MAX_AD_CREATIVE_IMAGES = 8;