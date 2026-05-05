'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  'FETCHING VIDEO TRANSCRIPT...',
  'EXTRACTING VIDEO FRAMES...',
  'READING VIEWER COMMENTS...',
  'ANALYZING VIDEO FRAMES...',
  'IDENTIFYING PARTS AND TOOLS...',
  'EXTRACTING TORQUE SPECIFICATIONS...',
  'ESTIMATING DIFFICULTY AND TIME...',
  'GENERATING PARTS DIAGRAM...',
  'BUILDING PROCESS FLOW...',
  'FINALIZING GUIDE...',
];

export function LoadingState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-20 max-w-md mx-auto">
      {/* Progress indicator */}
      <div className="relative w-16 h-16">
        <div className="w-16 h-16 rounded border-2 border-surface-container-highest border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl">construction</span>
        </div>
      </div>

      {/* Status message */}
      <div className="text-center space-y-2">
        <p className="text-label-caps text-primary animate-pulse">{MESSAGES[index]}</p>
        <div className="h-px w-48 bg-surface-container-high mx-auto overflow-hidden rounded-full">
          <div className="h-full bg-primary animate-pulse w-3/4" />
        </div>
      </div>

      <p className="text-xs text-on-surface-variant uppercase font-bold tracking-wide text-center">
        Analyzing transcript and video frames — usually 30–50 seconds.
      </p>

      {/* Progress steps */}
      <div className="w-full max-w-xs space-y-2">
        {MESSAGES.slice(0, 5).map((msg, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-sm shrink-0 ${i <= index % 5 ? 'bg-primary' : 'bg-surface-container-highest'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${i <= index % 5 ? 'text-on-surface-variant' : 'text-outline'}`}>
              {msg.replace('...', '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
