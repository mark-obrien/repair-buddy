export interface VehicleInfo {
  applicability: string;   // human-readable summary, e.g. "2018-2022 Toyota Camry" or "Universal"
  make?: string;
  model?: string;
  yearRange?: string;      // e.g. "2018-2022" or "2020"
  trim?: string;           // e.g. "All trims" or "LE, SE"
  notes?: string;          // additional compatibility notes
  isGeneral: boolean;      // true when no specific vehicle is identified
}

export interface RepairGuide {
  videoTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
  vehicleInfo: VehicleInfo;
  summary: string;
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
}
