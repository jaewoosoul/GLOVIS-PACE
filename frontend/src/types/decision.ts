export type SpeedOptionId = "A" | "B" | "C" | "D";

export type RecommendationLevel = "NORMAL" | "RECOMMENDED" | "CAUTION" | "DANGER";

export interface SpeedOptionResult {
  optionId: SpeedOptionId;
  label: string;
  speedKnots: number;
  sailingHours: number;
  arrivalDelayHours: number;
  /** 이 옵션대로 항해했을 때 항구 도착 시각(ISO). */
  arrivalAtIso: string;
  /** 옵션 A(현재 속도 유지) 기준 도착 시각(ISO) — "기존 대비" 비교의 기준값. */
  baselineArrivalAtIso: string;
  anchorageWaitingHours: number;
  fuelSavedTons: number;
  fuelCostSavedUsd: number;
  co2AvoidedTons: number;
  decisionCausedDelayHours: number;
  recommendationLevel: RecommendationLevel;
}

export type ScheduleStepStatus = "정상" | "협의 필요" | "지연" | "미계산";

export interface ScheduleDominoStep {
  key: string;
  label: string;
  status: ScheduleStepStatus;
  detail: string;
}

export type DecisionStatus = "DRAFT" | "APPROVED" | "EXECUTING" | "MONITORING" | "COMPLETED";

export type DocumentStatus = "생성 완료" | "검토 대기" | "발송 완료" | "불필요";

export type GeneratedDocumentType =
  | "CAPTAIN_INSTRUCTION"
  | "AGENCY_ETA_NOTICE"
  | "SHIPPER_NOTICE"
  | "SHIPPING_TEAM_REQUEST";

export interface GeneratedDocument {
  type: GeneratedDocumentType;
  label: string;
  status: DocumentStatus;
}

/**
 * SLOW_DOWN(항만 지연 대응 감속)과 SPEED_UP(선석 확보 증속)은 판단 기준이 서로 달라
 * 하나의 계산 로직을 공유하지 않는다 — decisionStore.decisionMode로 어느 입력 UI/계산 경로를 쓸지만 구분한다.
 */
export type DecisionMode = "SLOW_DOWN" | "SPEED_UP";

export interface BerthOpportunity {
  id: string;
  portCode: string;
  terminalName: string;
  /** "MM/DD HH:mm" 형식 */
  windowStartAt: string;
  /** "MM/DD HH:mm" 형식 */
  windowEndAt: string;
  nextAvailableWaitHours: number;
  responseDeadlineAt?: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export type ExecutionStageLabel =
  | "잠정 발효"
  | "지시 전달 완료"
  | "속도 변경 중"
  | "목표 속도 도달 · 모니터링 중"
  | "확정 발효";

/**
 * /decisions 하단 "실행 및 모니터링" 요약에 쓰는 축약 뷰 모델. decisionStore(활성 판단 1건)와
 * executionSimulation.ts의 계산 결과를 그대로 옮겨 담을 뿐, 별도 진행률 계산을 하지 않는다.
 */
export interface ExecutionSummary {
  /** executionRecordsStore의 recordId — 사건당 선박별로 고유하다(React key·개별 철회 대상 지정용). */
  recordId: string;
  decisionId: string;
  vesselId: string;
  vesselName: string;
  incidentTitle: string;
  port: string;
  mode: DecisionMode;
  modeLabel: "감속" | "증속";
  optionId: SpeedOptionId;
  baseSpeedKnots: number;
  targetSpeedKnots: number;
  currentSpeedKnots: number;
  approvedAt: number | null;
  stageLabel: ExecutionStageLabel;
  captainAcknowledged: boolean;
  actualSpeedApplied: boolean;
  costLabel: string;
  currentEtaLabel: string;
  revokeDeadlineAt: number | null;
}
