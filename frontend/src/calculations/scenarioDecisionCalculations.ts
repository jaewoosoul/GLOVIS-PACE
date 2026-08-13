/**
 * docs/GLOVIS_PACE_v7_통합_구현명세_Claude_Code.md §8~9 — 선박별 4옵션(현재 속도 유지/소폭 감속/표준 감속/최대 감속)
 * 운항 판단 계산. 순수 함수. AI는 이 계산에 관여하지 않는다.
 */
import type { ScenarioVessel } from "../data/scenarioVessels";
import type { DecisionOption, DecisionOptionKind, VesselDecisionCalculation } from "../types/scenarioDecision";
import {
  anchorageFuelTon,
  arrivalTiming,
  berthAvailableAt,
  candidateArrivalAt,
  co2AvoidedTon,
  fuelSavedTon,
  fuelSavedUsd,
  maxAbsorbableDelayHours,
  requiredSpeedKn,
  sailingFuelTon,
  sailingHours,
  totalFuelTon,
} from "./scenarioCalculations";

export interface CalculateDecisionInput {
  vessel: ScenarioVessel;
  /** NEWS 1차 판단: vessel.baseSpeedKn. RTA 2차 조정: 사용자가 확정한 현재 운항속도. */
  currentApprovedSpeedKn: number;
  remainingDistanceNm: number;
  calculationAtIso: string;
  /**
   * 필요 속도 계산에 쓰는, "지금부터 추가로 흡수해야 하는" 증분 지연. NEWS 1차 판단은
   * currentApprovedSpeedKn이 아직 기준속도라서 provisionalDelayHours 전체가 곧 증분이다.
   * RTA 재확정은 currentApprovedSpeedKn이 이미 1차 지연을 반영한 값이므로, 그 이후로
   * 추가로 더 흡수해야 하는 만큼(예: confirmed − provisional, 변화 없으면 0)만 넣는다.
   */
  additionalDelayHours: number;
  /**
   * 선석이 실제로 열리는 시각(berthAvailableAt = originalAssignedEta + totalDelayHours)을 계산하는
   * "원 스케줄 대비 총 확정 지연". 이미 얼마나 흡수했는지와 무관하게 항상 전체 지연값이어야 한다 —
   * additionalDelayHours(증분)를 여기에 쓰면 이미 반영된 지연분이 통째로 사라져 선석이 실제보다
   * 훨씬 일찍 열린 것처럼 계산된다.
   */
  totalDelayHours: number;
}

/**
 * 시나리오 고정 데이터(잔여거리/원 ETA)가 분 단위까지 완전히 맞아떨어지진 않아, 정확히 지연을
 * 흡수하는 옵션도 다운스트림 지연이 정확히 0이 아니라 수십 분 정도로 계산될 수 있다. 이 이내는
 * "사실상 0"으로 본다 — incidentOptionAdapter의 위험도 판정도 동일 기준을 써야 한다(§ 권고 로직).
 */
export const NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS = 0.5;

export function calculateVesselDecision(input: CalculateDecisionInput): VesselDecisionCalculation {
  const { vessel, currentApprovedSpeedKn, remainingDistanceNm, calculationAtIso, additionalDelayHours, totalDelayHours } = input;

  const maxDelay = maxAbsorbableDelayHours({ remainingDistanceNm, baseSpeedKn: vessel.baseSpeedKn, minSpeedKn: vessel.minSpeedKn });
  const rawRequiredSpeed = requiredSpeedKn({ remainingDistanceNm, currentSpeedKn: currentApprovedSpeedKn, additionalDelayHours });
  const requiredSpeed = Math.max(rawRequiredSpeed, vessel.minSpeedKn);

  const berthAvailable = berthAvailableAt(vessel.originalAssignedEtaIso, totalDelayHours);

  // 소폭 감속 = 유지와 필요 속도 사이 40% 지점 — 지연을 다 흡수하진 못하지만 유지보다는 나은 절충안을
  // "표준 감속(필요 속도)"과 별개 카드로 보여준다. 흡수할 지연이 없으면(requiredSpeed === currentApprovedSpeedKn)
  // 유지와 값이 같아져 아래 dedup에서 자동으로 사라진다.
  const slightSpeed = Math.max(currentApprovedSpeedKn - (currentApprovedSpeedKn - requiredSpeed) * 0.4, vessel.minSpeedKn);

  const candidates: Array<{ kind: DecisionOptionKind; label: string; speedKn: number }> = [
    { kind: "MAINTAIN", label: "현재 속도 유지", speedKn: currentApprovedSpeedKn },
    { kind: "SLIGHT", label: "소폭 감속", speedKn: slightSpeed },
    { kind: "REQUIRED", label: "표준 감속", speedKn: requiredSpeed },
    { kind: "MIN_SPEED", label: "최대 감속", speedKn: vessel.minSpeedKn },
  ];

  // 속도가 같은 옵션(예: 필요 속도가 하한과 같음)은 첫 등장만 남긴다.
  const seenSpeeds = new Set<number>();
  const dedupedCandidates = candidates.filter((c) => {
    const key = Math.round(c.speedKn * 1000);
    if (seenSpeeds.has(key)) return false;
    seenSpeeds.add(key);
    return true;
  });

  const baseline = dedupedCandidates.find((c) => c.kind === "MAINTAIN") ?? dedupedCandidates[0];
  const baselineArrival = candidateArrivalAt(calculationAtIso, remainingDistanceNm, baseline.speedKn);
  const baselineTiming = arrivalTiming(baselineArrival, berthAvailable);
  const baselineFuel = totalFuelTon(
    sailingFuelTon(baseline.speedKn, sailingHours(remainingDistanceNm, baseline.speedKn)),
    anchorageFuelTon(baselineTiming.waitHours),
  );

  const options: DecisionOption[] = dedupedCandidates.map((c) => {
    const candidateArrivalIso = candidateArrivalAt(calculationAtIso, remainingDistanceNm, c.speedKn);
    const timing = arrivalTiming(candidateArrivalIso, berthAvailable);
    const totalFuel = totalFuelTon(sailingFuelTon(c.speedKn, sailingHours(remainingDistanceNm, c.speedKn)), anchorageFuelTon(timing.waitHours));
    const savedTon = fuelSavedTon(baselineFuel, totalFuel);
    return {
      kind: c.kind,
      label: c.label,
      speedKn: c.speedKn,
      candidateArrivalIso,
      waitHours: timing.waitHours,
      berthingAtIso: timing.berthingAtIso,
      downstreamDelayHours: timing.downstreamDelayHours,
      fuelSavedTon: savedTon,
      fuelSavedUsd: fuelSavedUsd(savedTon),
      co2AvoidedTon: co2AvoidedTon(savedTon),
      isRecommended: false,
    };
  });

  // 권고: 하방 지연이 없는 옵션 중, 사건 지연을 정확히 흡수하는 필요 속도와 일치하는 옵션을 우선한다.
  const zeroDownstream = options.filter((o) => o.downstreamDelayHours <= NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS);
  const recommended = zeroDownstream.find((o) => Math.abs(o.speedKn - requiredSpeed) < 0.001) ?? zeroDownstream[0] ?? options[0];

  return {
    remainingDistanceNm,
    maxAbsorbableDelayHours: maxDelay,
    absorbable: additionalDelayHours <= maxDelay,
    options: options.map((o) => ({ ...o, isRecommended: o === recommended })),
  };
}
