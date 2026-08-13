/**
 * GLOVIS PACE v7 시나리오 계산 순수함수 — docs/GLOVIS_PACE_v7_통합_구현명세_Claude_Code.md §9를 그대로 구현한다.
 * 전부 결정론적 순수 함수다. AI는 이 계산에 절대 관여하지 않는다.
 *
 * 연료 공식(calculateDailyFuel)과 항해시간(calculateSailingHours)은 calculations/commonCalculations.ts와
 * 완전히 동일한 공식이라 그대로 재사용한다. 단가(V7_FUEL_PRICE_USD_PER_TON=640)는
 * commonCalculations.ts가 쓰는 값(638.5)과 달라, 서로 영향을 주지 않도록 이 파일 전용으로 둔다.
 */
import { calculateDailyFuel, calculateSailingHours } from "./commonCalculations";

export const V7_FUEL_PRICE_USD_PER_TON = 640;
export const V7_ANCHORAGE_FUEL_TON_PER_DAY = 5.0;
export const V7_CO2_TON_PER_FUEL_TON = 3.114;

export { calculateDailyFuel as fuelTonPerDay, calculateSailingHours as sailingHours };

/** T_max = D × (1/V_min − 1/V_base) — 감속만으로 흡수 가능한 최대 지연시간(h). */
export function maxAbsorbableDelayHours(input: { remainingDistanceNm: number; baseSpeedKn: number; minSpeedKn: number }): number {
  const { remainingDistanceNm: d, baseSpeedKn, minSpeedKn } = input;
  return d * (1 / minSpeedKn - 1 / baseSpeedKn);
}

/** V_req = D / (D/V_current + T_delay) — 지연을 정확히 항해시간으로 흡수하는 필요 속도. 하한 clamp는 호출부에서 한다. */
export function requiredSpeedKn(input: { remainingDistanceNm: number; currentSpeedKn: number; additionalDelayHours: number }): number {
  const { remainingDistanceNm: d, currentSpeedKn, additionalDelayHours } = input;
  if (d <= 0) throw new Error("remainingDistanceNm must be positive");
  if (currentSpeedKn <= 0) throw new Error("currentSpeedKn must be positive");
  if (additionalDelayHours < 0) {
    throw new Error("default v7 does not expect negative additional delay");
  }
  return d / (d / currentSpeedKn + additionalDelayHours);
}

export interface SpeedSegment {
  /** 이 구간이 시작된 시각(ISO). */
  fromIso: string;
  /** 이 구간이 끝난 시각(ISO) — 아직 진행 중이면 null(계산 시점까지로 취급). */
  toIso: string | null;
  speedKn: number;
}

/**
 * 속도 변경 이력을 반영한 특정 시각의 잔여거리.
 * TraveledDistance = Σ(segmentSpeed × segmentDuration), RemainingDistance = LegDistance − TraveledDistance (0 미만 clamp).
 *
 * baseSpeedKn은 speedHistory가 아직 덮지 않은 구간(출항 직후, 첫 속도 결정 전)에 적용하는 기본 순항속도다 —
 * speedHistory는 사용자가 실제로 속도를 확정/변경한 시점부터만 기록되므로, 그 이전 구간은 항상 기준속도로
 * 항해했다고 가정한다.
 */
export function remainingDistanceAt(
  legDistanceNm: number,
  departureAtIso: string,
  baseSpeedKn: number,
  speedHistory: SpeedSegment[],
  atIso: string,
): number {
  const atMs = new Date(atIso).getTime();
  const departureMs = new Date(departureAtIso).getTime();
  if (atMs <= departureMs) return legDistanceNm;

  const sorted = [...speedHistory].sort((a, b) => new Date(a.fromIso).getTime() - new Date(b.fromIso).getTime());

  let traveledNm = 0;
  let cursorMs = departureMs;

  for (const segment of sorted) {
    const segFromMs = Math.max(new Date(segment.fromIso).getTime(), departureMs);
    const segToMs = Math.min(segment.toIso ? new Date(segment.toIso).getTime() : atMs, atMs);
    if (segFromMs > cursorMs) {
      // segment 시작 전까지의 빈 구간은 기준속도로 항해한 것으로 본다.
      const gapEndMs = Math.min(segFromMs, atMs);
      traveledNm += baseSpeedKn * ((gapEndMs - cursorMs) / 3_600_000);
    }
    if (segToMs > segFromMs) {
      traveledNm += segment.speedKn * ((segToMs - segFromMs) / 3_600_000);
    }
    cursorMs = Math.max(cursorMs, segToMs);
  }

  if (cursorMs < atMs) {
    traveledNm += baseSpeedKn * ((atMs - cursorMs) / 3_600_000);
  }

  return Math.max(0, legDistanceNm - traveledNm);
}

/** BerthAvailableAt = OriginalAssignedEta + ActiveDelayHours. */
export function berthAvailableAt(originalAssignedEtaIso: string, activeDelayHours: number): string {
  return new Date(new Date(originalAssignedEtaIso).getTime() + activeDelayHours * 3_600_000).toISOString();
}

/** CandidateArrival = CalculationTime + RemainingDistance / CandidateSpeed. */
export function candidateArrivalAt(calculationAtIso: string, remainingDistanceNm: number, candidateSpeedKn: number): string {
  const hours = calculateSailingHours(remainingDistanceNm, candidateSpeedKn);
  return new Date(new Date(calculationAtIso).getTime() + hours * 3_600_000).toISOString();
}

export interface ArrivalTiming {
  waitHours: number;
  downstreamDelayHours: number;
  berthingAtIso: string;
}

/**
 * WaitHours = max(0, BerthAvailableAt − CandidateArrival)
 * DownstreamDelayHours = max(0, CandidateArrival − BerthAvailableAt) — 사건이 아니라 선택으로 만든 추가 지연.
 * BerthingAt = max(CandidateArrival, BerthAvailableAt)
 */
export function arrivalTiming(candidateArrivalIso: string, berthAvailableAtIso: string): ArrivalTiming {
  const candidateMs = new Date(candidateArrivalIso).getTime();
  const berthMs = new Date(berthAvailableAtIso).getTime();
  const waitHours = Math.max(0, (berthMs - candidateMs) / 3_600_000);
  const downstreamDelayHours = Math.max(0, (candidateMs - berthMs) / 3_600_000);
  const berthingAtIso = new Date(Math.max(candidateMs, berthMs)).toISOString();
  return { waitHours, downstreamDelayHours, berthingAtIso };
}

export function sailingFuelTon(speedKn: number, sailingHoursValue: number): number {
  return calculateDailyFuel(speedKn) * (sailingHoursValue / 24);
}

export function anchorageFuelTon(waitHours: number): number {
  return V7_ANCHORAGE_FUEL_TON_PER_DAY * (waitHours / 24);
}

export function totalFuelTon(sailingFuelTonValue: number, anchorageFuelTonValue: number): number {
  return sailingFuelTonValue + anchorageFuelTonValue;
}

/** 현재 속도 유지안을 기준으로 비교한다. */
export function fuelSavedTon(baselineTotalFuelTon: number, candidateTotalFuelTon: number): number {
  return baselineTotalFuelTon - candidateTotalFuelTon;
}

export function fuelSavedUsd(fuelSavedTonValue: number): number {
  return fuelSavedTonValue * V7_FUEL_PRICE_USD_PER_TON;
}

export function co2AvoidedTon(fuelSavedTonValue: number): number {
  return Math.max(0, fuelSavedTonValue) * V7_CO2_TON_PER_FUEL_TON;
}

export interface BerthOccupancy {
  vesselId: string;
  berthingAtIso: string;
  vacatedAtIso: string;
}

export interface BerthConflictResult {
  hasConflict: boolean;
  gapHours: number;
  /** gap이 음수(겹침)면 충돌 — 어느 두 선박이 겹치는지. */
  conflictingPairs: Array<{ a: string; b: string }>;
}

/** 같은 항만에 순차 접안하는 선박들의 선석 점유 구간이 겹치는지 검사한다. */
export function checkBerthConflict(occupancies: BerthOccupancy[]): BerthConflictResult {
  const sorted = [...occupancies].sort((a, b) => new Date(a.berthingAtIso).getTime() - new Date(b.berthingAtIso).getTime());
  let minGapHours = Infinity;
  const conflictingPairs: Array<{ a: string; b: string }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapHours = (new Date(curr.berthingAtIso).getTime() - new Date(prev.vacatedAtIso).getTime()) / 3_600_000;
    minGapHours = Math.min(minGapHours, gapHours);
    if (gapHours < 0) conflictingPairs.push({ a: prev.vesselId, b: curr.vesselId });
  }

  return {
    hasConflict: conflictingPairs.length > 0,
    gapHours: Number.isFinite(minGapHours) ? minGapHours : 0,
    conflictingPairs,
  };
}
