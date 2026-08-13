/** 리포트 페이지가 그리는 "완료된 운항 판단" 1건. 두 판단 시스템(레거시 신호/실제 사건) 모두 이 모양으로 정규화해 기록한다. */

export interface ReportTimelineEntry {
  label: string;
  atIso: string;
}

export type ReportDecisionMode = "SLOW_DOWN" | "SPEED_UP";

/**
 * LEGACY: 데모 신호(Singapore/Shanghai) 기반 판단.
 * INCIDENT_PRE_RTA: (더 이상 생성되지 않음 — localStorage에 남아있을 수 있는 과거 레코드 호환용)
 *   실제 사건에서 뉴스 추정치만으로 승인된 1차 판단. RTA 확정 전에 리포트가 중복 생성되는 문제가
 *   있어 제거했고, 지금은 RTA 확정 시점(INCIDENT_POST_RTA)에만 사건당 리포트 1건을 남긴다.
 * INCIDENT_POST_RTA: RTA 확정 후 추정치·확정치를 비교해 최종 확정한 판단(운항 판단 비교 화면에서 확정).
 */
export type ReportSource = "LEGACY" | "INCIDENT_PRE_RTA" | "INCIDENT_POST_RTA";

/** 1페이지 — 원문 뉴스 기사. 실제 사건(뉴스 분석 파이프라인을 탄) 판단에만 있다. */
export interface ReportNewsArticle {
  title: string;
  body: string;
  source: string;
  publishedAtLabel: string;
}

/** 1페이지 — AI가 뉴스에서 뽑아낸 구조화 판단. */
export interface ReportAiJudgment {
  summary: string;
  eventTypeLabel: string;
  eventStatusLabel: string;
  severityLabel: string;
  confidencePercent: number;
  estimatedDelayHours: number | null;
  evidence: string[];
}

/** 2페이지 — 선택한 옵션의 계산식에 대입된 실제 값. */
export interface ReportCalculationDetail {
  remainingDistanceNm: number;
  baseSpeedKn: number;
  minSpeedKn: number;
  /** 선석 가용 시각 계산에 쓰인 원 스케줄 대비 총 확정 지연(h). */
  delayHoursToAbsorb: number;
  /** 필요 속도 공식(V_필요 = D ÷ (D÷V_기준 + T_증분))에 실제로 대입된 증분 지연(h) — 이미 흡수한 만큼은 제외. */
  additionalDelayHours: number;
  /** 감속 하한(minSpeedKn) clamp 전, 공식으로 계산된 필요 속도 원값(kn). */
  requiredSpeedKnRaw: number;
  maxAbsorbableDelayHours: number;
  candidateArrivalIso: string;
  berthingAtIso: string;
  /** 사건 발생 전 원래 배정돼 있던 접안 예정 시각(scenarioVessel.originalAssignedEtaIso) — "원래 도착 vs 실제 도착" 비교용. */
  originalArrivalAtIso: string;
  /** 이 항차의 최초 출항 시각(scenarioVessel.departureAtIso). */
  departureAtIso: string;
  /** 이 항차 전체(route 배열 끝까지)의 최종 도착 시각(scenarioVessel.finalArrivalAtIso) — 사건 발생항(경유지)이 최종 목적지가 아닐 때를 위한 값. */
  finalArrivalAtIso: string;
  waitHours: number;
  sailingHours: number;
  fuelPriceUsdPerTon: number;
  anchorageFuelTonPerDay: number;
  co2FactorTonPerFuelTon: number;
  /** 2페이지 하단 미니 비교표 — RTA 확정 시점에 검토한 옵션(현재 속도 유지/필요 속도/감속 하한). */
  allOptions: ReportOptionRow[];
  /** 뉴스 접수(1차) 시점에 검토한 옵션 — RTA 도착 전 잠정 판단 때 계산된 옵션 목록. 없으면(레거시) 생략. */
  provisionalOptions?: ReportOptionRow[];
}

export interface ReportOptionRow {
  kind: string;
  label: string;
  speedKn: number;
  waitHours: number;
  downstreamDelayHours: number;
  fuelSavedTon: number;
  fuelSavedUsd: number;
  isSelected: boolean;
}

/** 3페이지 — "판단 없이 그대로(현재 속도 유지)" 대비 실제 선택안 비교 1행. */
export interface ReportComparisonPoint {
  label: string;
  speedKn: number;
  sailingHours: number;
  waitHours: number;
  fuelTon: number;
  costUsd: number;
  co2Ton: number;
  /** 이 옵션대로 갔을 때 실제 접안 시각(대기 반영) — 전후 비교 표에서 "도착 시각"으로 그대로 보여준다. */
  berthingAtIso: string;
}

export interface CompletedDecisionRecord {
  /** incidentId/signalId + vesselId + 판단 시각으로 조립 — 같은 사건이라도 판단 시점이 다르면 별개 기록. */
  id: string;
  source: ReportSource;
  vesselId: string;
  vesselName: string;
  incidentTitle: string;
  port: string;
  mode: ReportDecisionMode;
  modeLabel: "감속" | "증속";
  optionLabel: string;
  baseSpeedKnots: number;
  targetSpeedKnots: number;
  /** AI 분석 요약 또는 사건 사유 — "이유" */
  reason: string;
  /** 절감효과. 양수=절감, 음수=추가 비용("더 썼는지"). */
  netSavingsUsd: number;
  /** 연료 절감(t). 음수면 오히려 더 소모. */
  fuelSavedTons: number;
  /** CO2 절감(t). 음수면 오히려 더 배출. */
  co2AvoidedTons: number;
  decisionCausedDelayHours: number;
  timeline: ReportTimelineEntry[];
  approvedAt: string;
  completedAt: string;
  /** 아래 4개는 실제 사건(뉴스 분석 파이프라인을 탄 판단)에만 있다 — LEGACY 데모 신호는 undefined. */
  newsArticle?: ReportNewsArticle;
  aiJudgment?: ReportAiJudgment;
  calculationDetail?: ReportCalculationDetail;
  comparisonBaseline?: ReportComparisonPoint;
  comparisonSelected?: ReportComparisonPoint;
}
