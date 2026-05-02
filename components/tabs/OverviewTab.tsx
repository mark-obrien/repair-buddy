import Image from 'next/image';
import type { RepairGuide } from '@/lib/types';

interface Props {
  guide: RepairGuide;
}

export function OverviewTab({ guide }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0">
          <a href={guide.videoUrl} target="_blank" rel="noopener noreferrer">
            <Image
              src={guide.thumbnailUrl}
              alt={guide.videoTitle}
              width={320}
              height={180}
              className="rounded-lg object-cover w-full sm:w-80 hover:opacity-90 transition-opacity"
            />
          </a>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <h2 className="text-xl font-bold text-gray-900 leading-snug">{guide.videoTitle}</h2>
          <a
            href={guide.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.73a8.22 8.22 0 004.83 1.56V6.83a4.85 4.85 0 01-1.06-.14z"/>
            </svg>
            Watch on YouTube
          </a>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm uppercase tracking-wide">Summary</h3>
        <p className="text-gray-700 leading-relaxed">{guide.summary}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Parts', count: guide.partsNeeded.length, icon: '🔩' },
          { label: 'Tools', count: guide.standardTools.length + guide.specialtyTools.length, icon: '🔧' },
          { label: 'Steps', count: guide.repairSteps.length, icon: '📋' },
          { label: 'Torque specs', count: guide.torqueValues.length, icon: '⚙️' },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-2xl font-bold text-orange-500">{item.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
