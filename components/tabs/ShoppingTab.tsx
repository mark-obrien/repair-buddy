'use client';

import { useMemo } from 'react';
import type { RepairGuide } from '@/lib/types';

interface Props {
  parts: RepairGuide['partsNeeded'];
  vehicleInfo: RepairGuide['vehicleInfo'];
}

interface Retailer {
  id: string;
  name: string;
  icon: string;
  buildSearchUrl: (query: string) => string;
}

// Retailer search URLs. Affiliate tags would go here when programs are signed up
// for — e.g. Amazon's `tag=` param. Each retailer takes a query string and returns
// a search URL on their site.
const RETAILERS: Retailer[] = [
  {
    id: 'rockauto',
    name: 'RockAuto',
    icon: '🪨',
    buildSearchUrl: (q) =>
      `https://www.rockauto.com/en/partsearch/?partnum=${encodeURIComponent(q)}`,
  },
  {
    id: 'amazon',
    name: 'Amazon',
    icon: '📦',
    buildSearchUrl: (q) =>
      `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=automotive`,
  },
  {
    id: 'autozone',
    name: 'AutoZone',
    icon: '🟧',
    buildSearchUrl: (q) =>
      `https://www.autozone.com/searchresult?searchText=${encodeURIComponent(q)}`,
  },
  {
    id: 'oreilly',
    name: "O'Reilly",
    icon: '🟢',
    buildSearchUrl: (q) =>
      `https://www.oreillyauto.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'ebay',
    name: 'eBay Motors',
    icon: '🔵',
    buildSearchUrl: (q) =>
      `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=6000`,
  },
];

function buildQuery(part: RepairGuide['partsNeeded'][number], vehicle: RepairGuide['vehicleInfo']): string {
  // Prefer part number when available — most precise. Otherwise build a query
  // from vehicle + part name, which is what a person would type into a search box.
  if (part.partNumber) return part.partNumber;

  const bits: string[] = [];
  if (vehicle && !vehicle.isGeneral) {
    if (vehicle.yearRange) bits.push(vehicle.yearRange.split(/[-–]/)[0]); // first year for searchability
    if (vehicle.make) bits.push(vehicle.make);
    if (vehicle.model) bits.push(vehicle.model);
  }
  bits.push(part.name);
  return bits.join(' ');
}

export function ShoppingTab({ parts, vehicleInfo }: Props) {
  const partsWithQueries = useMemo(
    () => parts.map((p) => ({ part: p, query: buildQuery(p, vehicleInfo) })),
    [parts, vehicleInfo]
  );

  if (parts.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">🛒</div>
        <p className="text-sm">No parts to shop for.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <p className="mb-1">
          <strong>Tip:</strong> Click any retailer name to search for that part. Searches use the
          part number when available, or fall back to vehicle + part name.
        </p>
        <p className="text-gray-500">
          Repair Buddy doesn&apos;t sell parts and isn&apos;t paid for these links — they&apos;re just
          to save you typing.
        </p>
      </div>

      <div className="space-y-3">
        {partsWithQueries.map(({ part, query }, i) => (
          <div
            key={i}
            className="p-4 bg-white border border-gray-200 rounded-lg"
          >
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{part.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
                  {part.partNumber && (
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      {part.partNumber}
                    </span>
                  )}
                  {part.quantity != null && (
                    <span>Qty: {part.quantity}</span>
                  )}
                  {part.notes && <span>· {part.notes}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {RETAILERS.map((r) => (
                <a
                  key={r.id}
                  href={r.buildSearchUrl(query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 text-gray-700 hover:text-orange-700 transition-colors"
                  title={`Search ${r.name} for: ${query}`}
                >
                  <span>{r.icon}</span>
                  <span>{r.name}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
