'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ResultMeta {
  framesAnalyzed: number;
  researchPerformed: boolean;
  provider: string;
  model: string;
}

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(url: string, provider: string, model: string) {
    setStatus('loading');
    setError(null);
    setGuide(null);
    setMeta(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, provider, model }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setGuide(data.guide);
      setMeta({
        framesAnalyzed: data.framesAnalyzed ?? 0,
        researchPerformed: data.researchPerformed ?? false,
        provider: data.provider,
        model: data.model,
      });
      setStatus('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-3xl">🔧</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Repair Buddy</h1>
            <p className="text-xs text-gray-500">YouTube Repair Guide Generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-4">
            Paste a YouTube repair video URL to generate a structured guide with parts, tools, torque specs, and step-by-step instructions.
          </p>
          <UrlInputForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && error && <ErrorAlert message={error} />}

        {status === 'success' && guide && meta && (
          <>
            <div className="flex flex-wrap gap-2">
              {meta.researchPerformed && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full">
                  🔬 Pre-analysis research performed
                </span>
              )}
              {meta.framesAnalyzed > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full">
                  🎬 {meta.framesAnalyzed} video frames analyzed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
                  ⚠️ Transcript-only (no frames)
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                🤖 {meta.provider} / {meta.model}
              </span>
            </div>
            <GuideResults guide={guide} />
          </>
        )}

        {status === 'idle' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { icon: '🔬', title: 'Research-First AI', desc: 'Pre-researches the repair topic before watching the video' },
              { icon: '🎬', title: 'Video Frame Analysis', desc: 'Analyzes actual frames for accurate part diagrams' },
              { icon: '🤖', title: 'Your Choice of AI', desc: 'Anthropic, OpenAI, or Google — pick your model' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-3xl mb-2">{f.icon}</div>
                <p className="font-semibold text-gray-700 text-sm mb-1">{f.title}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
