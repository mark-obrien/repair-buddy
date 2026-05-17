'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { RepairGuide, Scene3D } from '@/lib/types';

const Scene3DCanvas = dynamic(
  () => import('./Scene3DCanvas').then((m) => ({ default: m.Scene3DCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center bg-gray-950" style={{ height: 540 }}>
        <span className="text-gray-500 text-sm">Loading 3D viewer…</span>
      </div>
    ),
  }
);

interface Props {
  guide: RepairGuide;
  frames: string[];
  provider: string;
  model: string;
}

export function Scene3DTab({ guide, frames, provider, model }: Props) {
  const [scene, setScene] = useState<Scene3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);

    // Strip the data URI prefix so the route only receives raw base64
    const oemDiagrams = (guide.manualDiagrams ?? [])
      .slice(0, 4)
      .map(({ src, caption }) => ({
        src: src.replace(/^data:image\/[^;]+;base64,/, ''),
        caption,
      }));

    try {
      const res = await fetch('/api/scene3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: frames.slice(0, 6),
          oemDiagrams,
          guide: {
            videoTitle: guide.videoTitle,
            summary: guide.summary,
            partsNeeded: guide.partsNeeded,
          },
          provider,
          model,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to generate 3D scene.');
        return;
      }
      setScene(data.scene);
    } catch {
      setError('Network error generating 3D scene.');
    } finally {
      setLoading(false);
    }
  }

  if (scene) {
    return (
      <div>
        <Scene3DCanvas scene={scene} />
        <div className="mt-2 flex justify-end px-1">
          <button
            onClick={() => setScene(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ↺ Regenerate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-14 gap-5 text-center">
      <div className="text-5xl select-none">🧊</div>

      <div>
        <h3 className="font-bold uppercase tracking-tight text-on-surface mb-1">AI-Generated 3D Schematic</h3>
        <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
          Claude analyzes video frames{guide.manualDiagrams?.length ? ' and OEM service manual diagrams' : ''} to build an interactive exploded-view model of the repair components.
        </p>
      </div>

      {guide.manualDiagrams && guide.manualDiagrams.length > 0 && (
        <div className="flex items-center gap-2 bg-primary-fixed/40 border border-primary/20 rounded px-3 py-2 max-w-xs">
          <span className="material-symbols-outlined text-primary text-sm">verified</span>
          <p className="text-label-caps text-primary text-[10px] uppercase">
            {guide.manualDiagrams.length} OEM diagram{guide.manualDiagrams.length !== 1 ? 's' : ''} will be used as reference
          </p>
        </div>
      )}

      {frames.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-xs">
          <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
          <p className="text-label-caps text-amber-700 text-[10px] uppercase">No frames available — re-analyze to extract frames</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-error/5 border border-error/20 rounded px-3 py-2 max-w-sm">
          <span className="material-symbols-outlined text-error text-sm">error</span>
          <p className="text-label-caps text-error text-[10px] uppercase">{error}</p>
        </div>
      )}

      <button
        onClick={generate}
        disabled={loading || frames.length === 0}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-label-caps font-bold rounded shadow-sm active:scale-95 transition-all"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
            GENERATING 3D SCENE...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-sm">view_in_ar</span>
            GENERATE 3D VIEW
          </>
        )}
      </button>

      {frames.length > 0 && !loading && (
        <p className="text-label-caps text-outline text-[10px] uppercase">
          {frames.length} frame{frames.length !== 1 ? 's' : ''}
          {guide.manualDiagrams?.length ? ` + ${guide.manualDiagrams.length} OEM diagram${guide.manualDiagrams.length !== 1 ? 's' : ''}` : ''}
          {' '}· ~10–20s
        </p>
      )}
    </div>
  );
}
