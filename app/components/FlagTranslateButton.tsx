import React from 'react';
import { codeToCountry } from '@/lib/flag-utils';

interface FlagTranslateButtonProps {
  langCode: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
}

export default function FlagTranslateButton({
  langCode,
  onClick,
  disabled = false,
  loading = false,
  title
}: FlagTranslateButtonProps) {
  const languageInfo = codeToCountry(langCode);
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-white
        text-gray-800
        px-7 
        py-5 
        rounded-full
        border
        border-gray-200
        shadow-md
        hover:shadow-lg
        hover:bg-gray-50
        disabled:bg-gray-100 
        disabled:text-gray-400
        disabled:cursor-not-allowed
        disabled:shadow-none
        flex
        items-center
        gap-0
        transition-all
        duration-200
        font-medium
      `}
      title={title}
      aria-label={`Översätt till ${languageInfo.display}`}
      aria-busy={loading}
    >
      {/* Flag badge - larger and more prominent */}
      <div className="
        w-10 
        h-10 
        rounded-full 
        bg-white 
        shadow-sm
        flex 
        items-center 
        justify-center 
        text-xl
        flex-shrink-0
        mr-1
      ">
        {languageInfo.emoji}
      </div>
      
      {/* Button text */}
      <span className="text-sm font-semibold">
        {languageInfo.display} ({langCode.toUpperCase()})
      </span>
      
      {/* Loading spinner */}
      {loading && (
        <div className="ml-2">
          <svg 
            className="animate-spin h-4 w-4 text-gray-600" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
