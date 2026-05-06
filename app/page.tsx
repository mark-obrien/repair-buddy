'use client';

import { useState, useEffect } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ShareButton } from '@/components/ShareButton';
import { RegenerateButton } from '@/components/RegenerateButton';
import { PrintButton } from '@/components/PrintButton';
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

export default function Home({
  params,
  searchParams,
}: {
  params?: { videoId?: string };
  searchParams?: { p?: string; m?: string };
} = {}) {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [garageVersion, setGarageVersion] = useState(0);

  useEffect(() => {
    const handleGarageUpdate = () => setGarageVersion(v => v + 1);
    window.addEventListener('garageUpdated', handleGarageUpdate);
    return () => window.removeEventListener('garageUpdated', handleGarageUpdate);
  }, []);

  useEffect(() => {
    if (params?.videoId && searchParams?.p && searchParams?.m) {
      const url = `https://www.youtube.com/watch?v=${params.videoId}`;
      runAnalysis(url, searchParams.p, searchParams.m, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.videoId, searchParams?.p, searchParams?.m]);

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
    <>
      {/* Generator / idle / error state */}
      {(status === 'idle' || status === 'error') && (
        <div className="max-w-3xl">
          <div className="mb-8 border-l-4 border-primary pl-6">
            <h1 className="text-3xl font-bold text-on-surface uppercase tracking-tight mb-2">
              Generate Repair Guide
            </h1>
            <p className="text-on-surface-variant">
              Paste a YouTube repair video URL to generate a structured guide with parts, tools, torque specs, and step-by-step instructions.
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-ambient p-6 mb-gutter">
            <p className="text-label-caps text-on-surface-variant mb-4 uppercase">Video URL</p>
            <UrlInputForm onSubmit={handleSubmit} isLoading={false} />
          </div>

          {status === 'error' && error && <ErrorAlert message={error} />}

          {status === 'idle' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter mt-gutter">
              {[
                { icon: 'biotech', title: 'Research-First AI', desc: 'Pre-researches the repair topic before watching the video' },
                { icon: 'movie', title: 'Frame & Comments Analysis', desc: 'Analyzes video frames and viewer feedback for accuracy' },
                { icon: 'garage', title: 'Save Your Vehicles', desc: 'Save vehicles to your garage and check applicability instantly' },
              ].map((f) => (
                <div key={f.title} className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4">
                  <span className="material-symbols-outlined text-primary text-2xl mb-2 block">{f.icon}</span>
                  <p className="text-label-caps text-on-surface font-bold mb-1 uppercase tracking-wide">{f.title}</p>
                  <p className="text-xs text-on-surface-variant">{f.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {status === 'loading' && <LoadingState />}

      {/* Guide results */}
      {status === 'success' && guide && meta && (
        <>
          <div className="mb-8 border-l-4 border-primary pl-6">
            <div className="flex flex-wrap gap-2 items-center mb-2">
              {guide.difficulty === 'expert' || guide.difficulty === 'advanced' ? (
                <span className="bg-error text-on-error text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                  {guide.difficulty === 'expert' ? 'CRITICAL REPAIR' : 'ADVANCED REPAIR'}
                </span>
              ) : null}
              {guide.difficulty && (
                <span className="bg-surface-container-high text-on-surface-variant text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                  DIFFICULTY: {guide.difficulty.toUpperCase()}
                </span>
              )}
              {meta.fromCache && (
                <span className="bg-secondary-container text-on-secondary-container text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                  CACHED
                </span>
              )}
              {meta.researchPerformed && (
                <span className="bg-primary-fixed text-primary text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                  RESEARCH-ENHANCED
                </span>
              )}
              {meta.framesAnalyzed > 0 && (
                <span className="bg-surface-container-high text-on-surface-variant text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                  {meta.framesAnalyzed} FRAMES
                </span>
              )}
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold text-on-surface uppercase tracking-tight mb-2">
              {guide.videoTitle}
            </h1>
            <p className="text-on-surface-variant max-w-3xl">{guide.summary}</p>

            <div className="flex flex-wrap gap-2 mt-4 print:hidden">
              <PrintButton />
              {videoId && (
                <ShareButton videoId={videoId} provider={meta.provider} model={meta.model} />
              )}
              <RegenerateButton onRegenerate={handleRegenerate} />
            </div>
          </div>

          <GuideResults
            key={garageVersion}
            guide={guide}
            frames={frames}
            provider={meta.provider}
            model={meta.model}
          />
        </>
      )}
    </>
  );
}
