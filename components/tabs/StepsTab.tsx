'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';

interface Props {
  steps: RepairGuide['repairSteps'];
  videoUrl: string;
  frames?: string[];
  annotations?: RepairGuide['frameAnnotations'];
}

function buildTimestampUrl(videoUrl: string, seconds: number): string {
  try {
    const url = new URL(videoUrl);
    url.searchParams.set('t', String(Math.floor(seconds)));
    return url.toString();
  } catch {
    return videoUrl;
  }
}

function formatTime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function FrameWithAnnotations({ 
  src, 
  alt, 
  className, 
  imageClassName = '',
  annotations 
}: { 
  src: string; 
  alt: string; 
  className: string; 
  imageClassName?: string;
  annotations?: Array<{ label: string; x: number; y: number; }>;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`w-full h-full object-cover ${imageClassName}`} />
      {annotations?.map((ann, i) => (
        <div 
          key={i} 
          className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
          style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-orange-500 border-[1.5px] border-white shadow shadow-black/50 animate-pulse group-hover:scale-125 transition-transform" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-lg">
            {ann.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StepsTab({ steps, videoUrl, frames = [], annotations = [] }: Props) {
  const [lightbox, setLightbox] = useState<{src: string, annotations?: Array<{label: string, x: number, y: number}>} | null>(null);

  if (steps.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">📋</div>
        <p className="text-sm">No repair steps were identified in this video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const hasFrame =
          step.frameIndex != null &&
          step.frameIndex >= 0 &&
          step.frameIndex < frames.length;
        const frameSrc = hasFrame ? `data:image/jpeg;base64,${frames[step.frameIndex!]}` : null;
        
        // Find annotations for this specific frame
        const stepAnnotations = hasFrame 
          ? annotations?.find(a => a.frameIndex === step.frameIndex)?.parts 
          : undefined;

        return (
          <div key={step.step} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg break-inside-avoid">
            <div className="shrink-0 w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
              {step.step}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                {step.timestampSeconds != null && (
                  <a
                    href={buildTimestampUrl(videoUrl, step.timestampSeconds)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded px-1.5 py-0.5 transition-colors print:hidden"
                    title="Watch this step on YouTube"
                  >
                    ▶ {formatTime(step.timestampSeconds)}
                  </a>
                )}
              </div>

              <div className="flex gap-3">
                {frameSrc && (
                  <button
                    type="button"
                    onClick={() => setLightbox({ src: frameSrc, annotations: stepAnnotations })}
                    className="shrink-0 print:hidden outline-none"
                    title="Click to enlarge"
                  >
                    <FrameWithAnnotations 
                      src={frameSrc} 
                      alt={`Frame for step ${step.step}`}
                      className="w-32 h-20 rounded overflow-hidden border border-gray-200 hover:border-orange-400 transition-colors cursor-zoom-in group/frame block"
                      annotations={stepAnnotations}
                    />
                  </button>
                )}
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{step.description}</p>
              </div>

              {step.warnings && step.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {step.warnings.map((w, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                      <span className="shrink-0">⚠️</span>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <FrameWithAnnotations
              src={lightbox.src}
              alt="Step frame expanded"
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl overflow-hidden cursor-auto"
              annotations={lightbox.annotations}
            />
            <button 
              className="absolute -top-4 -right-4 bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg hover:bg-gray-100 z-10"
              onClick={() => setLightbox(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
