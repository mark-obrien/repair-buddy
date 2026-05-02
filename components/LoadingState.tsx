'use client';

import { useEffect, useState } from 'react';

const MESSAGES = [
  'Fetching video transcript…',
  'Extracting video frames…',
  'Analyzing video frames…',
  'Identifying parts and tools…',
  'Extracting torque specifications…',
  'Generating parts diagram from frames…',
  'Building process flow…',
  'Almost done…',
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
    <div className="flex flex-col items-center gap-5 py-16">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🔧</span>
      </div>
      <p className="text-gray-600 text-base font-medium animate-pulse">{MESSAGES[index]}</p>
      <p className="text-sm text-gray-400">
        Analyzing transcript and video frames — usually 30–50 seconds.
      </p>
    </div>
  );
}
