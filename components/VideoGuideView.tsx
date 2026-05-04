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
      <div className="bg-black">
        <div className="relative w-full aspect-video">
          <div id="yt-player-host" className="absolute inset-0 w-full h-full" />
        </div>

        {/* Active step pill — only visible on narrow screens below the video */}
        {activeStep && (
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-t border-zinc-700 md:hidden">
            <div className="shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
              {activeStep.step}
            </div>
            <p className="text-xs font-semibold text-orange-100 truncate">{activeStep.title}</p>
          </div>
        )}
      </div>

      {/* ── Steps column ───────────────────────────────────────── */}
      {/*
        min-h-0 prevents this grid item from expanding the row beyond the
        video's aspect-ratio height. flex flex-col + flex-1 on the list
        makes inner overflow-y work correctly within that constrained height.
      */}
      <div className="min-h-0 flex flex-col border-t md:border-t-0 md:border-l border-gray-200">

        {/* Column header */}
        <div className="shrink-0 flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Repair Steps</h3>
          {!playerReady && (
            <span className="text-xs text-gray-400 animate-pulse">Loading player…</span>
          )}
          {playerReady && !hasTimestamps && (
            <span className="text-xs text-gray-400">no timestamps</span>
          )}
        </div>

        {/* Scrollable steps list */}
        <div className="flex-1 overflow-y-auto min-h-0 max-h-[50vh] md:max-h-none">
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
                  'flex gap-3 px-3 py-2.5 border-b border-gray-100 transition-all duration-150',
                  isActive ? 'bg-orange-50 border-l-[3px] border-l-orange-500 pl-[calc(0.75rem_-_3px)]' : 'border-l-[3px] border-l-transparent',
                  hasTs ? 'cursor-pointer hover:bg-gray-50' : '',
                ].join(' ')}
              >
                {/* Step number badge */}
                <div
                  className={`shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.step}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className={`text-xs font-semibold leading-snug ${isActive ? 'text-orange-900' : 'text-gray-800'}`}>
                      {step.title}
                    </p>
                    {hasTs && (
                      <span className={`shrink-0 text-xs font-mono tabular-nums ${isActive ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
                        {formatTime(step.timestampSeconds!)}
                      </span>
                    )}
                  </div>

                  {/* Full description + frame only for the active step */}
                  {isActive ? (
                    <>
                      <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
                      {frameSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={frameSrc}
                          alt={`Step ${step.step}`}
                          className="mt-2 w-full rounded border border-gray-200 object-cover"
                        />
                      )}
                      {step.warnings && step.warnings.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {step.warnings.map((w, i) => (
                            <div key={i} className="flex gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                              <span className="shrink-0">⚠️</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 truncate leading-snug">{step.description}</p>
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
