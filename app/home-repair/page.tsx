'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';
import { RegenerateButton } from '@/components/RegenerateButton';
import { PrintButton } from '@/components/PrintButton';
import { ShiftHeader } from '@/components/ShiftHeader';
import { ShiftSidebar } from '@/components/ShiftSidebar';

type Status = 'idle' | 'loading' | 'success' | 'error';
interface ResultMeta { framesAnalyzed: number; researchPerformed: boolean; commentsAnalyzed: number; provider: string; model: string; fromCache: boolean; cachedAt?: number; url: string; }

export default function HomeRepairPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(url: string, provider: string, model: string, force: boolean) {
    setStatus('loading');
    setError(null);
    if (!force) { setGuide(null); setFrames([]); setMeta(null); }
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, provider, model, force, category: 'home' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? 'Something went wrong.'); setStatus('error'); return; }
      setGuide(data.guide);
      setFrames(data.frames ?? []);
      setMeta({ framesAnalyzed: data.framesAnalyzed ?? 0, researchPerformed: data.researchPerformed ?? false, commentsAnalyzed: data.commentsAnalyzed ?? 0, provider: data.provider, model: data.model, fromCache: data.fromCache ?? false, cachedAt: data.cachedAt, url });
      setStatus('success');
    } catch { setError('Network error. Please check your connection.'); setStatus('error'); }
  }

  function handleSubmit(url: string, provider: string, model: string) { runAnalysis(url, provider, model, false); }
  function handleRegenerate() { if (!meta) return; runAnalysis(meta.url, meta.provider, meta.model, true); }

  const difficulty = guide?.difficulty;
  const difficultyLabel = difficulty ? difficulty.toUpperCase() : null;
  const isCritical = difficulty === 'expert' || difficulty === 'advanced';

  function resetToIdle() {
    setStatus('idle');
    setGuide(null);
    setFrames([]);
    setMeta(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background">
      <ShiftHeader onNewRepair={resetToIdle} />
      <ShiftSidebar activeSection="home" onNewRepair={resetToIdle} />

      <main className="lg:ml-64 pt-20 px-gutter lg:px-margin pb-xl">
        {(status === 'idle' || status === 'error' || status === 'loading') && (
          <div className="py-8">
            <div className="mb-6 border-l-4 border-primary pl-6">
              <p className="font-label-caps text-primary text-[10px] mb-1 tracking-widest">SHIFT TERMINAL V2.0</p>
              <h1 className="font-h2 text-on-surface uppercase mb-1">Home Repair Guide</h1>
              <p className="text-body-md text-on-surface-variant">Paste a YouTube home repair video URL to generate a structured DIY guide.</p>
            </div>
            <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-sm p-6 print:hidden">
              <UrlInputForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
            </div>
            {status === 'error' && error && (
              <div className="mt-4">
                <ErrorAlert message={error} />
              </div>
            )}
          </div>
        )}

        {status === 'loading' && <LoadingState />}

        {status === 'success' && guide && meta && (
          <>
            <div className="mb-6 border-l-4 border-primary pl-6 pt-8">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                {isCritical && (
                  <span className="bg-error text-on-error font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">CRITICAL REPAIR</span>
                )}
                {difficultyLabel && (
                  <span className="bg-surface-container-high text-on-surface-variant font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">DIFFICULTY: {difficultyLabel}</span>
                )}
                {meta.fromCache && (
                  <span className="bg-surface-container-high text-on-surface-variant font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">CACHED</span>
                )}
                {meta.framesAnalyzed > 0 && (
                  <span className="bg-primary-fixed text-primary font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">{meta.framesAnalyzed} FRAMES</span>
                )}
              </div>
              <h1 className="font-h2 text-on-surface uppercase mb-1">{guide.videoTitle}</h1>
              <p className="text-body-md text-on-surface-variant max-w-3xl">{guide.vehicleInfo?.applicability}</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 print:hidden">
              <PrintButton />
              <RegenerateButton onRegenerate={handleRegenerate} />
              <button
                onClick={resetToIdle}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              >
                ← NEW REPAIR
              </button>
            </div>

            <GuideResults guide={guide} frames={frames} provider={meta.provider} model={meta.model} category="home" />
          </>
        )}

        {status === 'idle' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter py-8">
            {[
              { icon: 'plumbing', label: 'Plumbing', desc: 'Faucets, toilets, pipes, water heaters, and drain repairs' },
              { icon: 'electrical_services', label: 'Electrical', desc: 'Outlets, switches, ceiling fans, fixtures, and panel basics' },
              { icon: 'hvac', label: 'HVAC & Appliances', desc: 'Furnaces, AC units, dishwashers, dryers, and refrigerators' },
            ].map((f) => (
              <div key={f.label} className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-6 shadow-sm">
                <span className="material-symbols-outlined text-primary text-3xl mb-3 block">{f.icon}</span>
                <p className="font-bold uppercase tracking-tight text-on-surface text-sm mb-1">{f.label}</p>
                <p className="text-xs text-on-surface-variant">{f.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
