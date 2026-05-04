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

    try {
      const res = await fetch('/api/scene3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: frames.slice(0, 6),
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
        <h3 className="font-semibold text-gray-800 mb-1">AI-Generated 3D Schematic</h3>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          Claude will analyze the video frames and build an interactive exploded-view
          model of the repair components.
        </p>
      </div>

      {frames.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xs">
          ⚠️ No frames available. Re-analyze the video to extract frames first.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">
          {error}
        </p>
      )}

      <button
        onClick={generate}
        disabled={loading || frames.length === 0}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Generating 3D scene…
          </>
        ) : (
          '🧊 Generate 3D View'
        )}
      </button>

      {frames.length > 0 && !loading && (
        <p className="text-xs text-gray-400">{frames.length} frame{frames.length !== 1 ? 's' : ''} available · ~10–20s</p>
      )}
    </div>
  );
}
