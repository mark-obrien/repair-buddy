export interface RepairGuide {
  videoTitle: string;
  videoUrl: string;
  thumbnailUrl: string;
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
