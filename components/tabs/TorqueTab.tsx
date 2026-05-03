'use client';

import { useState, useMemo } from 'react';
import type { RepairGuide } from '@/lib/types';

interface Props {
  torqueValues: RepairGuide['torqueValues'];
}

type Unit = 'native' | 'ft-lbs' | 'Nm' | 'in-lbs' | 'kg-m';

// Conversion factors to Nm (the SI base for torque)
const TO_NM: Record<string, number> = {
  'ft-lbs': 1.355817948,
  'Nm': 1,
  'in-lbs': 0.112984829,
  'kg-m': 9.80665,
};

const FROM_NM: Record<string, number> = {
  'ft-lbs': 1 / TO_NM['ft-lbs'],
  'Nm': 1,
  'in-lbs': 1 / TO_NM['in-lbs'],
  'kg-m': 1 / TO_NM['kg-m'],
};

// Display rounding per unit — Nm gets 1dp, ft-lbs gets whole numbers, in-lbs whole, kg-m 2dp
const PRECISION: Record<string, number> = {
  'ft-lbs': 0,
  'Nm': 1,
  'in-lbs': 0,
  'kg-m': 2,
};

function formatNumber(n: number, unit: string): string {
  const p = PRECISION[unit] ?? 1;
  // Avoid -0 from rounding
  const rounded = Math.abs(n) < 0.05 ? 0 : Number(n.toFixed(p));
  return rounded.toString();
}

// Parse a torque value string. Handles "85", "20-25", "20 to 25", "85+/-5".
// Returns [low, high] in the original unit, or null if unparseable.
function parseValue(s: string): [number, number] | null {
  const trimmed = s.trim();

  // Range: "20-25", "20–25", "20 to 25"
  const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[-–to]+\s*(-?\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]);
    const b = parseFloat(rangeMatch[2]);
    if (!isNaN(a) && !isNaN(b)) return [Math.min(a, b), Math.max(a, b)];
  }

  // "85 +/- 5" or "85±5"
  const tolMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(?:\+\/?-|±)\s*(\d+(?:\.\d+)?)/);
  if (tolMatch) {
    const center = parseFloat(tolMatch[1]);
    const tol = parseFloat(tolMatch[2]);
    if (!isNaN(center) && !isNaN(tol)) return [center - tol, center + tol];
  }

  // Single value
  const singleMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const v = parseFloat(singleMatch[1]);
    if (!isNaN(v)) return [v, v];
  }

  return null;
}

function convert(value: number, fromUnit: string, toUnit: string): number {
  const inNm = value * (TO_NM[fromUnit] ?? 1);
  return inNm * (FROM_NM[toUnit] ?? 1);
}

function displayConverted(originalValue: string, fromUnit: string, toUnit: string): string {
  const parsed = parseValue(originalValue);
  if (!parsed) return originalValue; // Couldn't parse — show as-is

  const [low, high] = parsed;
  const convertedLow = convert(low, fromUnit, toUnit);
  const convertedHigh = convert(high, fromUnit, toUnit);

  if (low === high) return formatNumber(convertedLow, toUnit);
  return `${formatNumber(convertedLow, toUnit)}–${formatNumber(convertedHigh, toUnit)}`;
}

const UNIT_OPTIONS: Array<{ id: Unit; label: string }> = [
  { id: 'native', label: 'As stated' },
  { id: 'ft-lbs', label: 'ft-lbs' },
  { id: 'Nm', label: 'Nm' },
  { id: 'in-lbs', label: 'in-lbs' },
  { id: 'kg-m', label: 'kg-m' },
];

export function TorqueTab({ torqueValues }: Props) {
  const [unit, setUnit] = useState<Unit>('native');

  const rows = useMemo(() => {
    return torqueValues.map((tv) => {
      if (unit === 'native') {
        return { ...tv, displayValue: tv.value, displayUnit: tv.unit };
      }
      const display = displayConverted(tv.value, tv.unit, unit);
      return { ...tv, displayValue: display, displayUnit: unit };
    });
  }, [torqueValues, unit]);

  if (torqueValues.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">⚙️</div>
        <p className="text-sm">No torque specifications were mentioned in this video.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 flex gap-2">
        <span className="shrink-0">⚠️</span>
        Always verify torque values against your vehicle&apos;s service manual. These are extracted from the video and may not cover all applications.
      </p>

      {/* Unit toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-3 print:hidden">
        <span className="text-xs text-gray-500 font-medium">Display in:</span>
        <div className="flex flex-wrap rounded-md border border-gray-200 overflow-hidden text-xs">
          {UNIT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setUnit(opt.id)}
              className={`px-3 py-1.5 transition-colors ${
                unit === opt.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-4 font-semibold text-gray-700">Component</th>
              <th className="pb-2 pr-4 font-semibold text-gray-700 text-right">Value</th>
              <th className="pb-2 pr-4 font-semibold text-gray-700">Unit</th>
              <th className="pb-2 font-semibold text-gray-700">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((tv, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="py-2.5 pr-4 font-medium text-gray-900">{tv.component}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="text-orange-600 font-bold font-mono">{tv.displayValue}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {tv.displayUnit}
                  </span>
                  {unit !== 'native' && tv.unit !== unit && (
                    <span className="text-xs text-gray-400 ml-1.5">
                      (orig {tv.value} {tv.unit})
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-gray-500 text-xs">{tv.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
