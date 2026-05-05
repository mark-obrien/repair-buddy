'use client';

import { useEffect, useRef, useState } from 'react';
import type { RepairGuide } from '@/lib/types';

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId?: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

interface Props {
  guide: RepairGuide;
  frames?: string[];
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch { /* ignore */ }
  return null;
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

export function VideoGuideView({ guide, frames = [] }: Props) {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Always-current poll function — avoids stale closures in setInterval
  const pollFnRef = useRef<() => void>(() => {});
  const mountedRef = useRef(true);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [playerReady, setPlayerReady] = useState(false);

  const videoId = extractVideoId(guide.videoUrl);
  const hasTimestamps = guide.repairSteps.some((s) => s.timestampSeconds != null);

  // Refresh poll function every render so it always sees the latest steps
  pollFnRef.current = () => {
    if (!playerRef.current) return;
    let t: number;
    try { t = playerRef.current.getCurrentTime(); } catch { return; }

    const steps = guide.repairSteps;
    let found = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].timestampSeconds != null && steps[i].timestampSeconds! <= t) found = i;
    }
    setActiveStepIndex(found);
  };

  // Auto-scroll active step into view in the panel
  useEffect(() => {
    if (activeStepIndex >= 0) {
      stepRefs.current[activeStepIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeStepIndex]);

  // Load YouTube IFrame API and init player
  useEffect(() => {
    mountedRef.current = true;
    if (!videoId) return;

    const initPlayer = () => {
      if (!mountedRef.current) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player('yt-player-host', {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => { if (mountedRef.current) setPlayerReady(true); },
          onStateChange: (e) => {
            const PLAYING = 1;
            if (e.data === PLAYING) {
              if (!intervalRef.current) {
                intervalRef.current = setInterval(() => pollFnRef.current(), 500);
              }
            } else {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        initPlayer();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  }, [videoId]);

  const seekToStep = (index: number) => {
    const step = guide.repairSteps[index];
    if (!playerRef.current || step.timestampSeconds == null) return;
    try {
      playerRef.current.seekTo(step.timestampSeconds, true);
      playerRef.current.playVideo();
    } catch { /* ignore */ }
    setActiveStepIndex(index);
  };

  if (!videoId) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Cannot extract video ID from the URL.
      </div>
    );
  }

  const activeStep = activeStepIndex >= 0 ? guide.repairSteps[activeStepIndex] : null;

  return (
    <div className="flex flex-col md:grid md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_360px]">

      {/* ── Video column ───────────────────────────────────────── */}
      <div className="bg-on-background">
        <div className="relative w-full aspect-video">
          <div id="yt-player-host" className="absolute inset-0 w-full h-full" />
        </div>

        {/* Active step pill — only visible on narrow screens below the video */}
        {activeStep && (
          <div className="flex items-center gap-2 px-3 py-2 bg-inverse-surface border-t border-outline/30 md:hidden">
            <div className="shrink-0 w-6 h-6 rounded bg-primary text-on-primary flex items-center justify-center text-xs font-bold font-mono">
              {activeStep.step}
            </div>
            <p className="text-xs font-bold text-inverse-on-surface truncate uppercase tracking-tight">{activeStep.title}</p>
          </div>
        )}
      </div>

      {/* ── Steps column ───────────────────────────────────────── */}
      <div className="min-h-0 flex flex-col border-t md:border-t-0 md:border-l border-surface-container-highest">

        {/* Column header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-surface-container-highest">
          <h3 className="text-label-caps text-on-surface uppercase font-bold">Repair Steps</h3>
          {!playerReady && (
            <span className="text-[10px] text-outline uppercase font-bold animate-pulse">LOADING...</span>
          )}
          {playerReady && !hasTimestamps && (
            <span className="text-[10px] text-outline uppercase font-bold">NO TIMESTAMPS</span>
          )}
        </div>

        {/* Scrollable steps list */}
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 max-h-[50vh] md:max-h-none">
          {guide.repairSteps.map((step, index) => {
            const isActive = index === activeStepIndex;
            const hasTs = step.timestampSeconds != null;
            const hasFrame =
              step.frameIndex != null &&
              step.frameIndex >= 0 &&
              step.frameIndex < frames.length;
            const frameSrc = hasFrame
              ? `data:image/jpeg;base64,${frames[step.frameIndex!]}`
              : null;

            return (
              <div
                key={step.step}
                ref={(el) => { stepRefs.current[index] = el; }}
                onClick={() => hasTs && seekToStep(index)}
                className={[
                  'flex gap-3 px-4 py-3 border-b border-surface-container-highest transition-all duration-150',
                  isActive
                    ? 'bg-primary-fixed/40 border-l-2 border-l-primary pl-[calc(1rem_-_2px)]'
                    : 'border-l-2 border-l-transparent',
                  hasTs ? 'cursor-pointer hover:bg-surface-container-low' : '',
                ].join(' ')}
              >
                {/* Step number badge */}
                <div
                  className={`shrink-0 mt-0.5 w-7 h-7 rounded flex items-center justify-center font-bold text-xs font-mono transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-high text-on-surface-variant border border-surface-container-highest'
                  }`}
                >
                  {step.step}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className={`text-xs font-bold uppercase tracking-tight leading-snug ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                      {step.title}
                    </p>
                    {hasTs && (
                      <span className={`shrink-0 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border ${
                        isActive
                          ? 'text-primary border-primary/30 bg-primary-fixed/40'
                          : 'text-outline border-surface-container-highest bg-surface-container-low'
                      }`}>
                        {formatTime(step.timestampSeconds!)}
                      </span>
                    )}
                  </div>

                  {/* Full description + frame only for the active step */}
                  {isActive ? (
                    <>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{step.description}</p>
                      {frameSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={frameSrc}
                          alt={`Step ${step.step}`}
                          className="mt-2 w-full rounded border border-surface-container-highest object-cover"
                        />
                      )}
                      {step.warnings && step.warnings.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {step.warnings.map((w, i) => (
                            <div key={i} className="flex gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <span className="shrink-0 material-symbols-outlined text-sm">warning</span>
                              <span className="uppercase font-bold">{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-outline truncate leading-snug">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
