
import React from 'react';
import { AdCheckStep } from '../types';
import { CheckIcon, LightBulbIcon, MagnifyingGlassIcon, DocumentTextIcon, SparklesIcon } from './icons/StepIcons';


interface StepperProps {
  currentStep: AdCheckStep;
}

const stepsConfig = [
  { id: AdCheckStep.Input, name: 'データ入力', icon: LightBulbIcon },
  { id: AdCheckStep.ProcessingStep1Step2, name: 'テキスト・OCR処理', icon: MagnifyingGlassIcon },
  { id: AdCheckStep.OCRVerification, name: 'OCR確認', icon: CheckIcon },
  { id: AdCheckStep.ReviewStep1Step2, name: '初期結果確認', icon: DocumentTextIcon},
  { id: AdCheckStep.ProcessingStep3Step4, name: '事実確認とレポート', icon: MagnifyingGlassIcon },
  { id: AdCheckStep.Complete, name: 'チェック完了', icon: SparklesIcon },
];

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  const getStepStatus = (stepId: AdCheckStep) => {
    if (currentStep === AdCheckStep.Error && stepId < AdCheckStep.Error) { // if error, mark previous steps based on where error might be.
       // This logic can be more nuanced if we know exactly which step failed.
       // For now, if currentStep is Error, and stepId is less than error, means it might have completed or it's the one that errored.
       // Let's assume steps before the "general error state" were completed for visual cue, unless currentStep becomes more granular for error.
       // For simplicity, let's treat any step that is not 'Error' step itself and is numerically less than current error step as 'completed'.
       // But the visual error itself will be shown on the current step if current step is Error.
      return 'completed'; // This might need refinement based on how error state is precisely set
    }
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };
  
  return (
    <nav aria-label="進捗" className="mb-8">
      <ol role="list" className="flex items-center justify-between">
        {stepsConfig.map((step, stepIdx) => {
          const status = getStepStatus(step.id);
          const IconComponent = step.icon;

          // Special handling for error state to show red border on the step that was "current" when error occurred
          // The AdCheckStep.Error itself is not in stepsConfig, so we infer.
          // If currentStep is Error, the actual "current" visual should be on the step that was being processed.
          // The `getStepStatus` currently simplifies this. The current stepper highlights AdCheckStep.Error as current if it's the value.
          // This behavior might need adjustment if AdCheckStep.Error isn't a "step" in the config.
          // For now, the general logic should mostly work.

          return (
            <li key={step.name} className={`relative flex-1 ${stepIdx !== stepsConfig.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
              {status === 'completed' ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className={`h-0.5 w-full ${currentStep === AdCheckStep.Error && step.id >= (currentStep -1) ? 'bg-blue-200' : 'bg-blue-500'}`} />
                  </div>
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full ${currentStep === AdCheckStep.Error && step.id >= (currentStep -1) ? 'bg-blue-100 border-2 border-blue-300' : 'bg-blue-500 hover:bg-blue-600 shadow-md'}`}
                  >
                    {currentStep === AdCheckStep.Error && step.id >= (currentStep-1) ? <IconComponent className="h-6 w-6 text-blue-400" aria-hidden="true" /> : <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />}
                    <span className="sr-only">{step.name} - 完了</span>
                  </div>
                </>
              ) : status === 'current' ? (
                 <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-blue-200" />
                  </div>
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 ${currentStep === AdCheckStep.Error ? 'border-red-500 bg-red-100' : 'border-blue-500 bg-white shadow-lg'}`}
                    aria-current="step"
                  >
                     {currentStep === AdCheckStep.Error ? <IconComponent className="h-6 w-6 text-red-500" aria-hidden="true" /> : <span className="h-3 w-3 rounded-full bg-blue-500" aria-hidden="true" />}
                     <span className="sr-only">{step.name} - 現在</span>
                  </div>
                </>
              ) : ( // upcoming
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-blue-200" />
                  </div>
                  <div
                    className="group relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-300 bg-white hover:border-blue-400 shadow-sm"
                  >
                     {/* Using the step's own icon for upcoming steps */}
                     <IconComponent className="h-5 w-5 text-blue-400 group-hover:text-blue-500" aria-hidden="true" />
                     <span className="sr-only">{step.name} - 未完了</span>
                  </div>
                </>
              )}
               <p className={`mt-2 text-xs text-center ${(status === 'completed' && !(currentStep === AdCheckStep.Error && step.id >= (currentStep -1)) ) || status === 'current' ? 'font-semibold text-blue-600' : 'text-blue-500'}`}>{step.name}</p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
