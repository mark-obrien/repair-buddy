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
  annotations,
}: {
  src: string;
  alt: string;
  className: string;
  imageClassName?: string;
  annotations?: Array<{ label: string; x: number; y: number }>;
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
          <div className="w-3 h-3 rounded-sm bg-primary border-[1.5px] border-on-primary shadow shadow-black/50 animate-pulse group-hover:scale-125 transition-transform" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-inverse-surface text-inverse-on-surface text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap shadow-lg uppercase">
            {ann.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StepsTab({ steps, videoUrl, frames = [], annotations = [] }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; annotations?: Array<{ label: string; x: number; y: number }> } | null>(null);

  if (steps.length === 0) {
    return (
      <div className="text-center py-10 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block text-outline">checklist</span>
        <p className="text-sm uppercase font-bold text-outline">No repair steps were identified in this video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const hasFrame =
          step.frameIndex != null &&
          step.frameIndex >= 0 &&
          step.frameIndex < frames.length;
        const frameSrc = hasFrame ? `data:image/jpeg;base64,${frames[step.frameIndex!]}` : null;

        const stepAnnotations = hasFrame
          ? annotations?.find((a) => a.frameIndex === step.frameIndex)?.parts
          : undefined;

        return (
          <div
            key={step.step}
            className={`bg-surface-container-lowest border border-surface-container-highest p-6 flex gap-6 relative rounded-lg shadow-ambient break-inside-avoid ${isLast ? 'tread-line-last' : 'tread-line'}`}
          >
            {/* Step number badge */}
            <div className="z-10 bg-primary text-on-primary font-mono w-8 h-8 flex items-center justify-center shrink-0 rounded shadow-sm font-bold text-sm">
              {step.step}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2 gap-2">
                <h3 className="font-bold text-on-surface uppercase tracking-tight text-sm">{step.title}</h3>
                {step.timestampSeconds != null && (
                  <a
                    href={buildTimestampUrl(videoUrl, step.timestampSeconds)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 bg-surface-container-low border border-surface-container-highest px-2 py-1 text-[10px] font-mono text-on-surface-variant rounded hover:border-primary hover:text-primary transition-colors print:hidden"
                    title="Watch this step on YouTube"
                  >
                    {formatTime(step.timestampSeconds)}
                  </a>
                )}
              </div>

              <div className="flex gap-4">
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
                      className="w-32 h-20 rounded overflow-hidden border border-surface-container-highest hover:border-primary transition-colors cursor-zoom-in block"
                      annotations={stepAnnotations}
                    />
                  </button>
                )}
                <p className="text-sm text-on-surface-variant leading-relaxed flex-1">{step.description}</p>
              </div>

              {/* Full-width frame image (print view) */}
              {frameSrc && (
                <FrameWithAnnotations
                  src={frameSrc}
                  alt={`Step ${step.step}`}
                  className="hidden print:block w-full h-48 mt-3 rounded overflow-hidden border border-surface-container-highest"
                  annotations={stepAnnotations}
                />
              )}

              {step.warnings && step.warnings.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {step.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 uppercase font-bold">
                      <span className="material-symbols-outlined text-amber-600 text-sm shrink-0">warning</span>
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
          className="fixed inset-0 bg-inverse-surface/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
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
              className="absolute -top-4 -right-4 bg-surface-container-lowest text-on-surface rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg hover:bg-surface-container-low z-10"
              onClick={() => setLightbox(null)}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
