/**
 * 6,500 CEU급 PCTC 대표 연료 곡선.
 * 실제 적용 시 선박별 Noon Report 회귀모델로 교체 가능하도록 상수만 별도 관리한다.
 */
export const FUEL_CURVE_A = 0.1727;
export const FUEL_CURVE_B = 0.217;

/** 일일 연료 사용량(t/day) = 0.1727 × V² − 0.217 × V */
export function calculateDailyFuel(speedKnots: number): number {
  return FUEL_CURVE_A * speedKnots ** 2 - FUEL_CURVE_B * speedKnots;
}

/** 항해시간(h) = 거리 / 속도 */
export function calculateSailingHours(distanceNm: number, speedKnots: number): number {
  return distanceNm / speedKnots;
}
