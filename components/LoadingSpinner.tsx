
import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50" aria-live="assertive" role="alertdialog" aria-busy="true">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="mt-4 text-xl text-slate-200 font-semibold">処理中です、しばらくお待ちください...</p>
      </div>
    </div>
  );
};
