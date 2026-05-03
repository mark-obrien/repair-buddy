'use client';

import { useEffect, useState } from 'react';
import type { VehicleInfo, SavedVehicle } from '@/lib/types';
import { getVehicles, findBestMatch, type MatchResult } from '@/lib/garage';

interface Props {
  vehicleInfo: VehicleInfo;
}

const STYLES: Record<MatchResult, { bg: string; border: string; text: string; icon: string; label: string }> = {
  match: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: '✅',
    label: 'This guide applies to your',
  },
  partial: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: '⚠️',
    label: 'May apply to your',
  },
  mismatch: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    icon: '❌',
    label: 'Does NOT apply to your',
  },
};

export function GarageMatchBanner({ vehicleInfo }: Props) {
  const [match, setMatch] = useState<{ vehicle: SavedVehicle; result: MatchResult } | null>(null);

  useEffect(() => {
    const vehicles = getVehicles();
    if (vehicles.length === 0) {
      setMatch(null);
      return;
    }
    setMatch(findBestMatch(vehicleInfo, vehicles));
  }, [vehicleInfo]);

  if (!match) return null;

  const style = STYLES[match.result];
  const v = match.vehicle;

  let detail = '';
  if (match.result === 'partial' && !vehicleInfo.isGeneral) {
    detail = vehicleInfo.yearRange
      ? ` — guide covers ${vehicleInfo.yearRange}, your ${v.year} may differ`
      : ' — verify before starting work';
  } else if (match.result === 'partial' && vehicleInfo.isGeneral) {
    detail = ' — this is a universal guide, applies to most vehicles';
  } else if (match.result === 'mismatch') {
    detail = ` — this guide is for ${vehicleInfo.applicability}`;
  }

  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${style.bg} ${style.border} ${style.text}`}>
      <span className="text-lg shrink-0">{style.icon}</span>
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">{style.label} {v.year} {v.make} {v.model}</span>
        {v.nickname && <span className="opacity-70"> (&ldquo;{v.nickname}&rdquo;)</span>}
        {detail}
      </p>
    </div>
  );
}
