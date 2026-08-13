/**
 * PORT PACE v7 운항 판단 선택지 — §11. 기존 4옵션(A/B/C/D, types/decision.ts)과는 완전히 별개다.
 * MAINTAIN(유지)/SLIGHT(소폭 감속)/REQUIRED(표준 감속)/MIN_SPEED(최대 감속) 4단계.
 */
export type DecisionOptionKind = "MAINTAIN" | "SLIGHT" | "REQUIRED" | "MIN_SPEED";

export interface DecisionOption {
  kind: DecisionOptionKind;
  label: string;
  speedKn: number;
  candidateArrivalIso: string;
  waitHours: number;
  berthingAtIso: string;
  downstreamDelayHours: number;
  fuelSavedTon: number;
  fuelSavedUsd: number;
  co2AvoidedTon: number;
  isRecommended: boolean;
}

export interface VesselDecisionCalculation {
  remainingDistanceNm: number;
  maxAbsorbableDelayHours: number;
  absorbable: boolean;
  options: DecisionOption[];
}
