export interface VehicleInfo {
  applicability: string;   // human-readable summary, e.g. "2018-2022 Toyota Camry" or "Universal"
  make?: string;
  model?: string;
  yearRange?: string;      // e.g. "2018-2022" or "2020"
  trim?: string;           // e.g. "All trims" or "LE, SE"
  notes?: string;          // additional compatibility notes
  isGeneral: boolean;      // true when no specific vehicle is identified
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface RepairGuide {
  videoTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  vehicleInfo: VehicleInfo;
  summary: string;

  difficulty?: Difficulty;
  difficultyReason?: string;
  estimatedTimeMinutes?: number;

  partsNeeded: Array<{
    name: string;
    partNumber?: string;
    quantity?: number;
    notes?: string;
  }>;
  standardTools: Array<{
    name: string;
    size?: string;
    notes?: string;
  }>;
  specialtyTools: Array<{
    name: string;
    purpose: string;
    altMethod?: string;
  }>;
  torqueValues: Array<{
    component: string;
    value: string;
    unit: string;
    notes?: string;
  }>;
  repairSteps: Array<{
    step: number;
    title: string;
    description: string;
    warnings?: string[];
    timestampSeconds?: number;
    frameIndex?: number;       // index into the frames[] array for inline display
  }>;
  warnings: string[];
  diagram: string;
  partsDiagram?: string;
}

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeResponse {
  guide?: RepairGuide;
  error?: string;
  framesAnalyzed?: number;
  frames?: string[];   // base64 JPEG strings, returned so the UI can render frame-grounded steps
}

// ---------------------------------------------------------------------------
// My Garage (client-side localStorage)
// ---------------------------------------------------------------------------
export interface SavedVehicle {
  id: string;          // uuid
  nickname?: string;   // "My daily driver"
  make: string;
  model: string;
  year: number;
  trim?: string;
  notes?: string;
  addedAt: number;     // unix ms
}
