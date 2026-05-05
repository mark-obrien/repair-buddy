'use client';

import { useState, FormEvent } from 'react';
import { ModelSelector } from '@/components/ModelSelector';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '@/lib/providers';

interface Props {
  onSubmit: (url: string, providerId: string, modelId: string) => void;
  isLoading: boolean;
}

export function UrlInputForm({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER);
  const [modelId, setModelId] = useState(DEFAULT_MODEL);
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
    onSubmit(trimmed, providerId, modelId);
  }

  function handleModelChange(newProvider: string, newModel: string) {
    setProviderId(newProvider);
    setModelId(newModel);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setValidationError('');
            }}
            placeholder="https://youtube.com/watch?v=..."
            disabled={isLoading}
            className="w-full px-4 py-3 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono"
          />
          {validationError && (
            <p className="mt-1.5 text-xs text-error font-bold uppercase">{validationError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-primary hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed text-on-primary font-bold rounded shadow-sm active:scale-95 transition-all flex items-center gap-2 justify-center whitespace-nowrap text-label-caps uppercase tracking-widest"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              ANALYZING...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">construction</span>
              GENERATE GUIDE
            </>
          )}
        </button>
      </div>

      <ModelSelector
        providerId={providerId}
        modelId={modelId}
        onChange={handleModelChange}
        disabled={isLoading}
      />
    </form>
  );
}
