'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ShareButton } from '@/components/ShareButton';
import { RegenerateButton } from '@/components/RegenerateButton';
import { PrintButton } from '@/components/PrintButton';
import { GarageModal } from '@/components/GarageModal';
import { extractVideoId } from '@/lib/youtube';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ResultMeta {
  framesAnalyzed: number;
  researchPerformed: boolean;
  commentsAnalyzed: number;
  provider: string;
  model: string;
  fromCache: boolean;
  cachedAt?: number;
  url: string;
}

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  // Bumping this state forces re-render of the GarageMatchBanner after garage edits
  const [garageVersion, setGarageVersion] = useState(0);

  async function runAnalysis(url: string, provider: string, model: string, force: boolean) {
    setStatus('loading');
    setError(null);
    if (!force) {
      setGuide(null);
      setFrames([]);
      setMeta(null);
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, provider, model, force }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setGuide(data.guide);
      setFrames(data.frames ?? []);
      setMeta({
        framesAnalyzed: data.framesAnalyzed ?? 0,
        researchPerformed: data.researchPerformed ?? false,
        commentsAnalyzed: data.commentsAnalyzed ?? 0,
        provider: data.provider,
        model: data.model,
        fromCache: data.fromCache ?? false,
        cachedAt: data.cachedAt,
        url,
      });
      setStatus('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  function handleSubmit(url: string, provider: string, model: string) {
    runAnalysis(url, provider, model, false);
  }

  function handleRegenerate() {
    if (!meta) return;
    runAnalysis(meta.url, meta.provider, meta.model, true);
  }

  const videoId = meta ? extractVideoId(meta.url) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-3xl">🔧</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Repair Buddy</h1>
            <p className="text-xs text-gray-500">YouTube Repair Guide Generator</p>
          </div>
          <button
            onClick={() => setGarageOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            title="Manage your saved vehicles"
          >
            🚗 My Garage
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:hidden">
          <p className="text-sm text-gray-600 mb-4">
            Paste a YouTube repair video URL to generate a structured guide with parts, tools, torque specs, and step-by-step instructions.
          </p>
          <UrlInputForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && error && <ErrorAlert message={error} />}

        {status === 'success' && guide && meta && (
          <>
            <div className="flex flex-wrap gap-2 items-center print:hidden">
              {meta.fromCache && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-full">
                  ⚡ Loaded from cache
                </span>
              )}
              {meta.researchPerformed && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full">
                  🔬 Pre-analysis research
                </span>
              )}
              {meta.framesAnalyzed > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full">
                  🎬 {meta.framesAnalyzed} frames analyzed
                </span>
              )}
              {meta.commentsAnalyzed > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-full">
                  💬 {meta.commentsAnalyzed} comments analyzed
                </span>
              )}
              {meta.framesAnalyzed === 0 && !meta.fromCache && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
                  ⚠️ Transcript-only (no frames)
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                🤖 {meta.provider} / {meta.model}
              </span>

              <div className="flex gap-2 sm:ml-auto">
                <PrintButton />
                {videoId && (
                  <ShareButton videoId={videoId} provider={meta.provider} model={meta.model} />
                )}
                <RegenerateButton onRegenerate={handleRegenerate} />
              </div>
            </div>

            {/* key forces remount of guide results when garage changes so the banner re-evaluates */}
            <GuideResults key={garageVersion} guide={guide} frames={frames} provider={meta.provider} model={meta.model} />
          </>
        )}

        {status === 'idle' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { icon: '🔬', title: 'Research-First AI', desc: 'Pre-researches the repair topic before watching the video' },
              { icon: '🎬', title: 'Frame & Comments Analysis', desc: 'Analyzes video frames and viewer feedback for accuracy' },
              { icon: '🚗', title: 'Save Your Vehicles', desc: 'Save vehicles to your garage and check applicability instantly' },
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

      <GarageModal
        isOpen={garageOpen}
        onClose={() => setGarageOpen(false)}
        onChange={() => setGarageVersion((v) => v + 1)}
      />
    </div>
  );
}
