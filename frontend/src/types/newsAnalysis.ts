/**
 * backend/src/ai/news/newsAnalysisSchema.ts의 NewsAnalysis 스키마를 그대로 미러링한 타입.
 * 백엔드와 프런트엔드가 별도 npm 패키지라 타입을 직접 공유할 수 없어 손으로 맞춘다 —
 * 검증(zod)은 백엔드에서만 하고, 프런트는 이미 검증된 값을 그리는 용도로만 이 타입을 쓴다.
 */

export type OperationalRelevance = "RELEVANT" | "MONITOR" | "IRRELEVANT";
export type DecisionReadiness = "READY" | "MONITOR_ONLY" | "NO_IMPACT" | "INSUFFICIENT_INFORMATION";

export type NewsEventType =
  | "LABOR_STRIKE"
  | "TYPHOON"
  | "PORT_CONGESTION"
  | "BERTH_CLOSURE"
  | "BERTH_OPENING"
  | "EQUIPMENT_FAILURE"
  | "PORT_CLOSURE"
  | "PORT_RECOVERY"
  | "WEATHER_DISRUPTION"
  | "PILOTAGE_DISRUPTION"
  | "TOWAGE_DISRUPTION"
  | "OTHER";

export type NewsEventStatus = "RUMOR" | "PREDICTED" | "WATCHING" | "CONFIRMED" | "ONGOING" | "RECOVERING" | "RESOLVED" | "UNKNOWN";

export type NewsSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AffectedOperation = "BERTHING" | "CARGO_HANDLING" | "DEPARTURE" | "PILOTAGE" | "TOWAGE" | "ANCHORAGE" | "PORT_ENTRY" | "UNKNOWN";

export type EvidenceSupport =
  | "OPERATIONAL_RELEVANCE"
  | "EVENT_TYPE"
  | "EVENT_STATUS"
  | "AFFECTED_PORT"
  | "AFFECTED_OPERATION"
  | "START_TIME"
  | "END_TIME"
  | "DURATION"
  | "DELAY"
  | "SEVERITY";

export interface AffectedPort {
  mentionedName: string;
  canonicalName: string | null;
  unLocode: string | null;
  terminal: string | null;
  affectedOperations: AffectedOperation[];
}

export interface HourRange {
  min: number;
  max: number | null;
}

export interface NewsTiming {
  eventStartAt: string | null;
  eventEndAt: string | null;
  timezone: string | null;
  reportedDurationHours: HourRange | null;
  reportedDelayHours: HourRange | null;
}

export interface NewsEvidenceItem {
  quote: string;
  supports: EvidenceSupport[];
}

export interface NewsAnalysis {
  operationalRelevance: OperationalRelevance;
  requiresOperationalReview: boolean;
  decisionReadiness: DecisionReadiness;
  eventType: NewsEventType;
  eventStatus: NewsEventStatus;
  severity: NewsSeverity;
  affectedPorts: AffectedPort[];
  timing: NewsTiming;
  evidence: NewsEvidenceItem[];
  summary: string;
  uncertainties: string[];
  missingRequiredInformation: string[];
  exclusionReason: string | null;
  confidence: number;
  analysisSource: "CLAUDE";
}

export interface NewsAnalyzeRequestBody {
  id?: string;
  title: string;
  content: string;
  source?: string;
  publishedAt: string;
  sourceTimezone?: string;
  language?: string;
}
