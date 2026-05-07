'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { RepairGuide } from '@/lib/types';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PrintButton } from '@/components/PrintButton';
import Link from 'next/link';

interface GuideMeta {
  framesAnalyzed: number;
  provider: string;
  model: string;
  cachedAt: number;
  frames: string[];
}

export default function SharedGuidePage() {
  const params = useParams<{ videoId: string }>();
  const searchParams = useSearchParams();

  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [meta, setMeta] = useState<GuideMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const videoId = params.videoId;
    // library links use short aliases p= and m=
    const provider = searchParams.get('provider') ?? searchParams.get('p') ?? '';
    const model = searchParams.get('model') ?? searchParams.get('m') ?? '';

    if (!videoId) { setError('Invalid video ID.'); setLoading(false); return; }

    fetch(`/api/guide/${videoId}?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGuide(data.guide);
        setMeta({
          framesAnalyzed: data.framesAnalyzed ?? 0,
          provider: data.provider,
          model: data.model,
          cachedAt: data.cachedAt,
          frames: data.frames ?? [],
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load guide.'))
      .finally(() => setLoading(false));
  }, [params.videoId, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span>
      </div>
    );
  }

  if (error || !guide || !meta) {
    return (
      <div className="max-w-xl">
        <ErrorAlert message={error ?? 'Guide not found.'} />
        <Link href="/guides" className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:underline">
          ← Back to Guide Library
        </Link>
      </div>
    );
  }

  const difficulty = guide.difficulty;
  const difficultyLabel = difficulty ? difficulty.toUpperCase() : null;
  const isCritical = difficulty === 'expert' || difficulty === 'advanced';

  return (
    <>
      {/* Guide header */}
      <div className="mb-6 border-l-4 border-primary pl-6">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          {guide.category && (
            <span className="bg-primary text-on-primary font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">{guide.category}</span>
          )}
          {isCritical && (
            <span className="bg-error text-on-error font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">CRITICAL REPAIR</span>
          )}
          {difficultyLabel && (
            <span className="bg-surface-container-high text-on-surface-variant font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">DIFFICULTY: {difficultyLabel}</span>
          )}
          {meta.framesAnalyzed > 0 && (
            <span className="bg-primary-fixed text-primary font-bold px-2 py-0.5 text-[10px] rounded-sm uppercase tracking-widest">{meta.framesAnalyzed} FRAMES</span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-on-surface uppercase tracking-tight mb-1">{guide.videoTitle}</h1>
        <p className="text-sm text-on-surface-variant max-w-3xl">{guide.vehicleInfo?.applicability}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6 print:hidden">
        <PrintButton />
        <Link
          href="/guides"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
        >
          ← Guide Library
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
        >
          + New Repair
        </Link>
      </div>

      <GuideResults guide={guide} frames={meta.frames} provider={meta.provider} model={meta.model} category={guide.category} />
    </>
  );
}
