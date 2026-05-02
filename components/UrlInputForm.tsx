'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInputForm({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a YouTube URL.');
      return;
    }
    if (!trimmed.match(/youtube\.com|youtu\.be/)) {
      setValidationError('Please enter a valid YouTube URL.');
      return;
    }
    setValidationError('');
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setValidationError('');
            }}
            placeholder="Paste a YouTube repair video URL…"
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-base"
          />
          {validationError && (
            <p className="mt-1.5 text-sm text-red-600">{validationError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2 justify-center whitespace-nowrap"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing…
            </>
          ) : (
            'Generate Guide'
          )}
        </button>
      </div>
    </form>
  );
}
