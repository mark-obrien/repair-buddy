'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [framesAnalyzed, setFramesAnalyzed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(url: string) {
    setStatus('loading');
    setError(null);
    setGuide(null);
    setFramesAnalyzed(0);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setGuide(data.guide);
      setFramesAnalyzed(data.framesAnalyzed ?? 0);
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

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-600 mb-4">
            Paste a YouTube repair video URL to instantly generate a structured guide with parts,
            tools, torque specs, and step-by-step instructions.
          </p>
          <UrlInputForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && error && <ErrorAlert message={error} />}
        {status === 'success' && guide && (
          <>
            {framesAnalyzed > 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <span>🎬</span>
                <span>
                  Parts diagram generated from <strong>{framesAnalyzed} video frames</strong> — layout reflects actual video content.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <span>⚠️</span>
                <span>
                  Video frame extraction was unavailable — parts diagram is based on transcript and general knowledge.
                </span>
              </div>
            )}
            <GuideResults guide={guide} />
          </>
        )}

        {status === 'idle' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              {
                icon: '🎬',
                title: 'Video Frame Analysis',
                desc: 'Actual frames extracted and analyzed for accurate part diagrams',
              },
              {
                icon: '⚙️',
                title: 'Torque Specifications',
                desc: 'Every torque value mentioned in the video',
              },
              {
                icon: '🔩',
                title: 'Parts & Tools',
                desc: 'OEM part numbers, standard and specialty tools',
              },
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
