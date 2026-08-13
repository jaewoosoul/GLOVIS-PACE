/**
 * PORT PACE v7 시나리오 자사선 5척 — docs/PORT_PACE_v7_통합_구현명세_Claude_Code.md §4를 그대로 반영한다.
 * data/fleetData.ts의 VESSELS(대시보드·지도 표시용)는 여기 값을 실제 기준으로 삼아 맞춰져 있다 —
 * departureAtIso/originalAssignedEtaIso는 이 파일이, 화면에 보이는 최종 도착항/ETA는 VESSELS가 갖는다.
 *
 * originalAssignedEta는 RTA 접안 슬롯 조정 구간과 매칭하는 유일한 기준값이라 시나리오 시작 시점에
 * 고정한다 — 감속 후 재계산된 도착시각으로 절대 다시 매칭하지 않는다(§10.3).
 */

export type ScenarioVesselId = "GLOVIS-E" | "GLOVIS-D" | "GLOVIS-C" | "GLOVIS-B" | "GLOVIS-A";

export interface ScenarioVessel {
  id: ScenarioVesselId;
  capacityCeu: number;
  ageYears: number;
  baseSpeedKn: number;
  minSpeedKn: number;
  cargoHandlingHours: number;
  /** 항로 전체(도착 순서), 표시용. */
  route: string[];
  /** 이번 시연에서 다루는 구간의 출발항 UN/LOCODE. */
  originPortCode: string;
  /** 이번 시연에서 다루는 구간의 목적항 UN/LOCODE — incidentStore가 이 값으로 사건-선박을 매칭한다. */
  destinationPortCode: string;
  destinationPortName: string;
  legDistanceNm: number;
  /** 이 구간의 출항 시각(KST, +09:00 명시 ISO). */
  departureAtIso: string;
  /** RTA 접안 슬롯 조정 구간과 매칭하는 고정 기준값 — 절대 재계산하지 않는다. */
  originalAssignedEtaIso: string;
  /**
   * 이번 항차 전체(route 배열 끝까지)의 최종 도착 시각 — 지도 위치 계산 전용. A/B/C처럼 destinationPortCode
   * (사건 발생항)가 route의 중간 지점일 때, originalAssignedEtaIso로 위치를 계산하면 "사건 발생항 도착
   * 시각 = route 전체를 다 지나온 시점"으로 잘못 매핑돼 실제보다 훨씬 앞서가 보인다(예: 싱가포르 사건이
   * 발생하기도 전에 이미 싱가포르를 지나쳐 보이는 문제). D/E는 목적항이 곧 최종항이라 originalAssignedEtaIso와 같다.
   */
  finalArrivalAtIso: string;
  /** 기본 시연 시작(2026-10-02 12:00) 시점의 상태. */
  initialStatus: "PLANNED" | "SAILING" | "COMPLETED";
}

export const SCENARIO_VESSELS: ScenarioVessel[] = [
  {
    id: "GLOVIS-B",
    capacityCeu: 4300,
    ageYears: 10,
    baseSpeedKn: 15.5,
    minSpeedKn: 12.0,
    cargoHandlingHours: 13,
    route: ["Shanghai", "Singapore", "Zeebrugge"],
    originPortCode: "CNSHA",
    destinationPortCode: "SGSIN",
    destinationPortName: "Singapore",
    legDistanceNm: 2210,
    departureAtIso: "2026-10-01T08:00:00+09:00",
    originalAssignedEtaIso: "2026-10-07T07:00:00+09:00",
    // V-11: 제브뤼헤 최종 도착.
    finalArrivalAtIso: "2026-10-30T16:00:00+09:00",
    initialStatus: "PLANNED",
  },
  {
    id: "GLOVIS-C",
    capacityCeu: 7500,
    ageYears: 8,
    baseSpeedKn: 17.0,
    minSpeedKn: 13.0,
    cargoHandlingHours: 20,
    route: ["Busan", "Singapore", "Bremerhaven"],
    originPortCode: "KRPUS",
    destinationPortCode: "SGSIN",
    destinationPortName: "Singapore",
    legDistanceNm: 2499,
    departureAtIso: "2026-10-02T08:00:00+09:00",
    originalAssignedEtaIso: "2026-10-08T11:00:00+09:00",
    // V-12: 브레머하펜 최종 도착.
    finalArrivalAtIso: "2026-10-30T17:00:00+09:00",
    initialStatus: "PLANNED",
  },
  {
    id: "GLOVIS-D",
    capacityCeu: 6000,
    ageYears: 5,
    baseSpeedKn: 17.0,
    minSpeedKn: 13.0,
    cargoHandlingHours: 17,
    route: ["Incheon", "Shanghai", "Rotterdam"],
    originPortCode: "CNSHA",
    destinationPortCode: "NLRTM",
    destinationPortName: "Rotterdam",
    legDistanceNm: 10500,
    departureAtIso: "2026-10-31T12:00:00+09:00",
    originalAssignedEtaIso: "2026-11-26T06:00:00+09:00",
    // V-15: RTA 확정(+31h) 반영한 실제 접안 시각 — originalAssignedEtaIso(원계획, 지연 반영 전)를 쓰면
    // 지도 위치가 실제보다 31h 앞서가 보인다(§ resolveLiveVesselPos는 이 값을 100% 지점으로 쓴다).
    finalArrivalAtIso: "2026-11-27T13:00:00+09:00",
    initialStatus: "PLANNED",
  },
  {
    id: "GLOVIS-E",
    capacityCeu: 8000,
    ageYears: 3,
    baseSpeedKn: 17.5,
    minSpeedKn: 13.0,
    cargoHandlingHours: 22,
    route: ["Shanghai", "Rotterdam"],
    originPortCode: "CNSHA",
    destinationPortCode: "NLRTM",
    destinationPortName: "Rotterdam",
    legDistanceNm: 10500,
    departureAtIso: "2026-11-03T09:00:00+09:00",
    originalAssignedEtaIso: "2026-11-28T09:00:00+09:00",
    // V-17: RTA 확정(+28h) 반영한 실제 접안 시각 — D와 같은 이유로 originalAssignedEtaIso를 쓰지 않는다.
    finalArrivalAtIso: "2026-11-29T13:00:00+09:00",
    initialStatus: "PLANNED",
  },
  {
    id: "GLOVIS-A",
    capacityCeu: 6500,
    ageYears: 12,
    baseSpeedKn: 16.0,
    minSpeedKn: 12.5,
    cargoHandlingHours: 18,
    route: ["Hong Kong", "Southampton", "Bremerhaven"],
    originPortCode: "HKHKG",
    destinationPortCode: "GBSOU",
    destinationPortName: "Southampton",
    // §14.1: E-01(09/02 09:00) 시점 잔여거리가 정확히 9,492nm이 되도록 역산(9,700 − 16.0kn×13h=9,492).
    legDistanceNm: 9700,
    departureAtIso: "2026-09-01T20:00:00+09:00",
    // §5.1 R-01: GLOVIS-A 원계획 Southampton ETA — RTA 구간(09/26~09/28, +24h)과 매칭되는 고정 기준값.
    originalAssignedEtaIso: "2026-09-27T02:00:00+09:00",
    // 최종 도착(브레머하펜).
    finalArrivalAtIso: "2026-09-30T08:00:00+09:00",
    // 1막(사우샘프턴)이 시연의 시작이라 GLOVIS-A도 처음부터 항해 중이다(E-01 발생 시점 기준).
    initialStatus: "SAILING",
  },
];

/**
 * COMPLETED 여부는 여기(정적 initialStatus)가 아니라 호출부가 scenarioVesselStore의 "런타임" 상태로
 * 걸러야 한다 — 항차를 마친 선박은 새 사건과 매칭하지 않되, 그 판정 기준은 항상 최신 실행 상태여야
 * 한다. (순환 참조 방지: 이 파일은 scenarioVesselStore를 import하지 않는다.)
 */
export function vesselsForDestinationPort(portCode: string): ScenarioVessel[] {
  return SCENARIO_VESSELS.filter((v) => v.destinationPortCode === portCode);
}

/**
 * 시뮬레이션 가상 시계(nowMs) 기준, 이 선박이 전체 항차(departureAtIso → finalArrivalAtIso, route 배열
 * 전체)를 얼마나 지나왔는지 0~100 사이로 계산한다 — MAP_ROUTES의 전체 폴리라인에 대응하는 값이라
 * originalAssignedEtaIso(사건 발생항 도착, route 중간 지점)가 아니라 finalArrivalAtIso를 끝점으로 써야
 * 한다. 지도에서 GLOVIS A~E가 "다음 이벤트"를 누를 때마다 실제로 항로를 따라 전진하는 것처럼 보이게
 * 하는 데 쓴다 — 출항 전엔 0%, 도착 이후엔 100%로 고정된다.
 */
export function computeScenarioVesselProgressPercent(vessel: ScenarioVessel, nowMs: number): number {
  const startMs = new Date(vessel.departureAtIso).getTime();
  const endMs = new Date(vessel.finalArrivalAtIso).getTime();
  if (nowMs <= startMs) return 0;
  if (nowMs >= endMs) return 100;
  return ((nowMs - startMs) / (endMs - startMs)) * 100;
}
