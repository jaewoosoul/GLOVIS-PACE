import { describe, expect, it } from "vitest";
import {
  arrivalTiming,
  candidateArrivalAt,
  checkBerthConflict,
  fuelTonPerDay,
  maxAbsorbableDelayHours,
  remainingDistanceAt,
  requiredSpeedKn,
  sailingHours,
} from "./scenarioCalculations";

describe("fuelTonPerDay", () => {
  it("계산 공식(0.1727V² − 0.217V)을 그대로 따른다", () => {
    expect(fuelTonPerDay(15)).toBeCloseTo(0.1727 * 225 - 0.217 * 15, 6);
  });
});

describe("sailingHours / requiredSpeedKn / maxAbsorbableDelayHours — §14.2 D선(싱가포르)", () => {
  const remainingDistanceNm = 2210 - 15.5 * 30; // 10/02 14:00 기준, 출항 후 경과 30h
  it("이동거리·잔여거리가 명세와 일치한다", () => {
    expect(15.5 * 30).toBe(465);
    expect(remainingDistanceNm).toBe(1745);
  });
  it("흡수 한계가 32.8h", () => {
    const maxDelay = maxAbsorbableDelayHours({ remainingDistanceNm, baseSpeedKn: 15.5, minSpeedKn: 12.0 });
    expect(maxDelay).toBeCloseTo(32.8, 1);
  });
  it("필요 속도가 13.57kn", () => {
    const speed = requiredSpeedKn({ remainingDistanceNm, currentSpeedKn: 15.5, additionalDelayHours: 16 });
    expect(speed).toBeCloseTo(13.57, 2);
  });
});

describe("§14.3 C선(싱가포르)", () => {
  const remainingDistanceNm = 2499 - 17.0 * 6; // 출항 후 경과 6h
  it("이동거리·잔여거리가 명세와 일치한다", () => {
    expect(17.0 * 6).toBe(102);
    expect(remainingDistanceNm).toBe(2397);
  });
  it("흡수 한계가 약 43.4h", () => {
    const maxDelay = maxAbsorbableDelayHours({ remainingDistanceNm, baseSpeedKn: 17.0, minSpeedKn: 13.0 });
    expect(maxDelay).toBeCloseTo(43.4, 1);
  });
  it("필요 속도가 15.27kn", () => {
    const speed = requiredSpeedKn({ remainingDistanceNm, currentSpeedKn: 17.0, additionalDelayHours: 16 });
    expect(speed).toBeCloseTo(15.27, 2);
  });
});

describe("§14.4 B선(로테르담) — 1단계·2단계", () => {
  const legDistanceNm = 10500;
  const departureAtIso = "2026-10-31T12:00:00+09:00";
  const newsAtIso = "2026-11-04T10:00:00+09:00"; // 94h 경과
  const rtaAtIso = "2026-11-24T06:00:00+09:00";

  it("1단계: 잔여거리 8,902nm, 필요 속도 16.20kn", () => {
    const remaining1 = remainingDistanceAt(legDistanceNm, departureAtIso, 17.0, [], newsAtIso);
    expect(remaining1).toBeCloseTo(8902, 0);
    const speed1 = requiredSpeedKn({ remainingDistanceNm: remaining1, currentSpeedKn: 17.0, additionalDelayHours: 26 });
    expect(speed1).toBeCloseTo(16.2, 1);

    // 2단계: RTA 확정 31h(추가 +5h), 1단계 속도로 갱신된 speedHistory 반영
    const remaining2 = remainingDistanceAt(
      legDistanceNm,
      departureAtIso,
      17.0,
      [{ fromIso: newsAtIso, toIso: null, speedKn: speed1 }],
      rtaAtIso,
    );
    expect(remaining2).toBeGreaterThan(1190);
    expect(remaining2).toBeLessThan(1200);

    const speed2 = requiredSpeedKn({ remainingDistanceNm: remaining2, currentSpeedKn: speed1, additionalDelayHours: 5 });
    expect(speed2).toBeCloseTo(15.17, 1);
  });
});

describe("§14.5 A선(로테르담) — 1단계·2단계", () => {
  const legDistanceNm = 10500;
  const departureAtIso = "2026-11-03T09:00:00+09:00";
  const newsAtIso = "2026-11-04T10:00:00+09:00"; // 25h 경과
  const rtaAtIso = "2026-11-24T06:00:00+09:00";

  it("1단계: 잔여거리 약 10,062nm, 필요 속도 16.74kn", () => {
    const remaining1 = remainingDistanceAt(legDistanceNm, departureAtIso, 17.5, [], newsAtIso);
    expect(remaining1).toBeCloseTo(10062.5, 0);
    const speed1 = requiredSpeedKn({ remainingDistanceNm: remaining1, currentSpeedKn: 17.5, additionalDelayHours: 26 });
    expect(speed1).toBeCloseTo(16.74, 2);

    const remaining2 = remainingDistanceAt(
      legDistanceNm,
      departureAtIso,
      17.5,
      [{ fromIso: newsAtIso, toIso: null, speedKn: speed1 }],
      rtaAtIso,
    );
    expect(remaining2).toBeGreaterThan(2085);
    expect(remaining2).toBeLessThan(2100);

    const speed2 = requiredSpeedKn({ remainingDistanceNm: remaining2, currentSpeedKn: speed1, additionalDelayHours: 2 });
    expect(speed2).toBeCloseTo(16.48, 1);
  });
});

describe("§14.1 E선 — 전체 v7 재생용(독립 검증)", () => {
  it("필요 속도가 15.38kn", () => {
    const speed = requiredSpeedKn({ remainingDistanceNm: 9492, currentSpeedKn: 16.0, additionalDelayHours: 24 });
    expect(speed).toBeCloseTo(15.38, 2);
  });

  it("data/scenarioVessels.ts의 실제 GLOVIS-A 값으로도 E-01 시점(09/02 09:00) 잔여거리가 9,492nm이 된다", () => {
    // legDistanceNm=9700, departureAtIso=09/01 20:00, baseSpeedKn=16.0 → 13h 경과 × 16kn = 208nm 이동
    const remaining = remainingDistanceAt(9700, "2026-09-01T20:00:00+09:00", 16.0, [], "2026-09-02T09:00:00+09:00");
    expect(remaining).toBeCloseTo(9492, 0);
    const speed = requiredSpeedKn({ remainingDistanceNm: remaining, currentSpeedKn: 16.0, additionalDelayHours: 24 });
    expect(speed).toBeCloseTo(15.38, 2);
  });

  it("originalAssignedEta(09/27 02:00)가 흡수 한계(약 166h) 안이라 24h 지연은 감속만으로 흡수 가능하다", () => {
    const maxDelay = maxAbsorbableDelayHours({ remainingDistanceNm: 9492, baseSpeedKn: 16.0, minSpeedKn: 12.5 });
    expect(maxDelay).toBeGreaterThan(24);
  });
});

describe("arrivalTiming / candidateArrivalAt — §14.6 로테르담 선석 점유", () => {
  it("B/A 접안·하역 완료 시각과 31시간 간격, 충돌 없음", () => {
    // B: RTA 계산 시점(11/24 06:00) 잔여거리로 2단계 속도(15.17kn) 항해 → berthAvailableAt과 정확히 일치하도록 설계됨
    const bBerthAvailable = "2026-11-27T13:00:00+09:00"; // originalAssignedEta(11/26 06:00) + confirmed 31h
    const bCandidateArrival = candidateArrivalAt("2026-11-24T06:00:00+09:00", 1193.15, 15.17);
    const bTiming = arrivalTiming(bCandidateArrival, bBerthAvailable);
    expect(new Date(bTiming.berthingAtIso).toISOString().slice(0, 16)).toBe("2026-11-27T04:00");
    // (부동소수 반올림 오차 허용 — 실제 검증은 아래 berthConflict가 명세값 자체로 수행)

    const bVacatedAtIso = "2026-11-28T06:00:00+09:00"; // B 접안(11/27 13:00) + 하역 17h
    const aBerthingAtIso = "2026-11-29T13:00:00+09:00";
    const aVacatedAtIso = "2026-11-30T11:00:00+09:00"; // A 접안 + 하역 22h

    const conflict = checkBerthConflict([
      { vesselId: "GLOVIS-D", berthingAtIso: "2026-11-27T13:00:00+09:00", vacatedAtIso: bVacatedAtIso },
      { vesselId: "GLOVIS-E", berthingAtIso: aBerthingAtIso, vacatedAtIso: aVacatedAtIso },
    ]);
    expect(conflict.hasConflict).toBe(false);
    expect(conflict.gapHours).toBeCloseTo(31, 0);
  });
});

describe("sailingHours", () => {
  it("거리/속도", () => {
    expect(sailingHours(1000, 20)).toBe(50);
  });
});
