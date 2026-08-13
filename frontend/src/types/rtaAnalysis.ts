/**
 * backend/src/ai/rta/rtaAnalysisSchema.ts의 RtaAnalysis 스키마를 그대로 미러링한 타입.
 * 백엔드와 프런트엔드가 별도 npm 패키지라 타입을 직접 공유할 수 없어 손으로 맞춘다 —
 * 검증(zod)은 백엔드에서만 하고, 프런트는 이미 검증된 값을 그리는/계산하는 용도로만 이 타입을 쓴다.
 */

export type RtaEvidenceSupport = "PORT" | "REFERENCE_NUMBER" | "ISSUED_AT" | "ETA_BAND" | "ADJUSTMENT_HOURS" | "CLEARANCE_TIME" | "INCIDENT_LINK";

export interface RtaEtaBand {
  label: string;
  fromEtaIso: string | null;
  toEtaIso: string | null;
  isOpenEnded: boolean;
  adjustmentHours: number;
}

export interface RtaEvidenceItem {
  quote: string;
  supports: RtaEvidenceSupport[];
}

export interface RtaAnalysis {
  referenceNumber: string | null;
  issuedAt: string | null;
  issuer: string | null;
  portMentionedName: string;
  portCanonicalName: string | null;
  portUnLocode: string | null;
  incidentSummary: string;
  expectedClearanceAt: string | null;
  nextNoticeAt: string | null;
  etaBands: RtaEtaBand[];
  evidence: RtaEvidenceItem[];
  uncertainties: string[];
  confidence: number;
  analysisSource: "CLAUDE";
}

export interface RtaAnalyzeRequestBody {
  id?: string;
  text: string;
}
