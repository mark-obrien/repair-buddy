'use client';

import type { SavedVehicle, VehicleInfo } from './types';

const STORAGE_KEY = 'repair-buddy:garage:v1';

// ---------------------------------------------------------------------------
// CRUD against localStorage. Safe in SSR (returns empty during prerender).
// ---------------------------------------------------------------------------
export function getVehicles(): SavedVehicle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidVehicle);
  } catch {
    return [];
  }
}

function isValidVehicle(v: unknown): v is SavedVehicle {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.make === 'string' &&
    typeof obj.model === 'string' &&
    typeof obj.year === 'number' &&
    typeof obj.addedAt === 'number'
  );
}

export function saveVehicles(vehicles: SavedVehicle[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  } catch (err) {
    console.warn('Failed to save garage:', err);
  }
}

export function addVehicle(v: Omit<SavedVehicle, 'id' | 'addedAt'>): SavedVehicle {
  const vehicle: SavedVehicle = {
    ...v,
    id: crypto.randomUUID(),
    addedAt: Date.now(),
  };
  const all = getVehicles();
  saveVehicles([...all, vehicle]);
  return vehicle;
}

export function removeVehicle(id: string): void {
  saveVehicles(getVehicles().filter((v) => v.id !== id));
}

// ---------------------------------------------------------------------------
// Applicability matching — does a guide's vehicleInfo apply to a saved vehicle?
// Returns one of:
//   'match'   — guide explicitly covers this vehicle
//   'partial' — make/model match but year out of range, or universal
//   'mismatch'— guide is for a different vehicle entirely
// ---------------------------------------------------------------------------
export type MatchResult = 'match' | 'partial' | 'mismatch';

export function checkApplicability(guide: VehicleInfo, vehicle: SavedVehicle): MatchResult {
  if (guide.isGeneral) return 'partial';

  const guideMake = guide.make?.toLowerCase().trim();
  const guideModel = guide.model?.toLowerCase().trim();
  const vMake = vehicle.make.toLowerCase().trim();
  const vModel = vehicle.model.toLowerCase().trim();

  if (guideMake && guideMake !== vMake) return 'mismatch';
  if (guideModel && !modelsMatch(guideModel, vModel)) return 'mismatch';

  // Make + model align (or guide didn't specify). Check year range.
  if (!guide.yearRange) return 'partial';

  const range = parseYearRange(guide.yearRange);
  if (!range) return 'partial';

  if (vehicle.year >= range.start && vehicle.year <= range.end) return 'match';
  return 'partial';
}

function modelsMatch(a: string, b: string): boolean {
  // Tolerant matching — "Camry SE" vs "Camry" should both match a "Camry" guide
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function parseYearRange(s: string): { start: number; end: number } | null {
  const trimmed = s.trim();
  // "2018-2022", "2018–2022", "2018 to 2022"
  const rangeMatch = trimmed.match(/(\d{4})\s*[-–to]+\s*(\d{4})/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) return { start, end };
  }
  // Single year "2020"
  const singleMatch = trimmed.match(/^(\d{4})$/);
  if (singleMatch) {
    const y = parseInt(singleMatch[1], 10);
    return { start: y, end: y };
  }
  // "2018+", "2018 onwards"
  const openMatch = trimmed.match(/(\d{4})\s*[+]/);
  if (openMatch) {
    const y = parseInt(openMatch[1], 10);
    return { start: y, end: 9999 };
  }
  return null;
}

// Best matching vehicle for a guide, or null
export function findBestMatch(
  guide: VehicleInfo,
  vehicles: SavedVehicle[]
): { vehicle: SavedVehicle; result: MatchResult } | null {
  if (vehicles.length === 0) return null;

  let best: { vehicle: SavedVehicle; result: MatchResult } | null = null;
  const rank: Record<MatchResult, number> = { match: 3, partial: 2, mismatch: 1 };

  for (const v of vehicles) {
    const result = checkApplicability(guide, v);
    if (!best || rank[result] > rank[best.result]) {
      best = { vehicle: v, result };
    }
  }
  return best;
}
