import { describe, expect, it } from "vitest";
import {
  SIMULATION_EVENTS,
  SIMULATION_START_MS,
  SOUTHAMPTON_CRANE_INCIDENT_ID,
  type NoiseFilterReason,
} from "./simulationEvents";
import { matchBand } from "../stores/incidentStore";

const noiseFilterById: Record<string, NoiseFilterReason | undefined> = Object.fromEntries(
  SIMULATION_EVENTS.filter((e) => e.sourceType === "NOISE").map((e) => [e.eventId, e.filteredBy]),
);

describe("1막(E-01/R-01) 이벤트 데이터", () => {
  const e01 = SIMULATION_EVENTS.find((e) => e.eventId === "E-01")!;
  const r01 = SIMULATION_EVENTS.find((e) => e.eventId === "R-01")!;

  it("E-01은 관련 뉴스라 시계를 정지시키고(pauseOnTrigger), Southampton 사건에 연결된다", () => {
    expect(e01.sourceType).toBe("NEWS");
    expect(e01.pauseOnTrigger).toBe(true);
    expect(e01.incidentId).toBe(SOUTHAMPTON_CRANE_INCIDENT_ID);
    expect(e01.portCode).toBe("GBSOU");
  });

  it("R-01은 E-01과 같은 incidentId를 공유해 새 사건을 만들지 않고 기존 사건을 갱신한다", () => {
    expect(r01.sourceType).toBe("RTA");
    expect(r01.pauseOnTrigger).toBe(true);
    expect(r01.incidentId).toBe(e01.incidentId);
  });

  it("R-01의 접안 슬롯 조정 구간(09/26~09/28: +24h)이 GLOVIS-A 원계획 ETA(09/27 02:00)와 매칭된다", () => {
    const band = matchBand("2026-09-27T02:00:00+09:00", [
      { label: "09/26~09/28", fromEtaIso: "2026-09-26T00:00:00+09:00", toEtaIso: "2026-09-28T00:00:00+09:00", isOpenEnded: false, adjustmentHours: 24 },
      { label: "09/29~09/30", fromEtaIso: "2026-09-29T00:00:00+09:00", toEtaIso: "2026-09-30T00:00:00+09:00", isOpenEnded: false, adjustmentHours: 14 },
      { label: "10/01~", fromEtaIso: "2026-10-01T00:00:00+09:00", toEtaIso: null, isOpenEnded: true, adjustmentHours: 0 },
    ]);
    expect(band?.adjustmentHours).toBe(24);
  });

  it("E-01(09/02 09:00)이 기본 시작 시각(09/02 00:00) 이후라 첫 이벤트로 정상 실행 대상이다", () => {
    expect(e01.atMs).toBeGreaterThanOrEqual(SIMULATION_START_MS);
  });
});

describe("노이즈 뉴스 10건 — 필터링 사유(§6)", () => {
  it("PORT_MISMATCH(항만 불일치) 7건", () => {
    for (const id of ["N-01", "N-03", "N-05", "N-07", "N-08", "N-09", "N-10"]) {
      expect(noiseFilterById[id], id).toBe("PORT_MISMATCH");
    }
  });

  it("TIME_WINDOW_MISMATCH(시점 불일치) — N-02, N-04", () => {
    expect(noiseFilterById["N-02"]).toBe("TIME_WINDOW_MISMATCH");
    expect(noiseFilterById["N-04"]).toBe("TIME_WINDOW_MISMATCH");
  });

  it("CAUSE_NOT_OPERATIONAL(사유 유형 무관) — N-06", () => {
    expect(noiseFilterById["N-06"]).toBe("CAUSE_NOT_OPERATIONAL");
  });

  it("노이즈는 전부 pauseOnTrigger=false이고 incidentId가 없어(구조적으로) 운항 판단 카드가 생성되지 않는다", () => {
    const noiseEvents = SIMULATION_EVENTS.filter((e) => e.sourceType === "NOISE");
    expect(noiseEvents.length).toBeGreaterThanOrEqual(10);
    for (const event of noiseEvents) {
      expect(event.pauseOnTrigger).toBe(false);
      expect(event.incidentId).toBeNull();
    }
  });
});

describe("이벤트 순서/중복 방지(§7·§8)", () => {
  it("SIMULATION_EVENTS는 eventId가 전부 고유하다", () => {
    const ids = SIMULATION_EVENTS.map((e) => e.eventId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("E-01(09/02 09:00)이 N-01(09/03 08:00)보다 먼저 온다 — 표기 번호가 아니라 시각순", () => {
    const e01 = SIMULATION_EVENTS.find((e) => e.eventId === "E-01")!;
    const n01 = SIMULATION_EVENTS.find((e) => e.eventId === "N-01")!;
    expect(e01.atMs).toBeLessThan(n01.atMs);
  });

  it("1막(E-01) → 2막(E-02) → 3막(E-03) 순서로 시각이 흐른다", () => {
    const e01 = SIMULATION_EVENTS.find((e) => e.eventId === "E-01")!;
    const e02 = SIMULATION_EVENTS.find((e) => e.eventId === "E-02")!;
    const e03 = SIMULATION_EVENTS.find((e) => e.eventId === "E-03")!;
    expect(e01.atMs).toBeLessThan(e02.atMs);
    expect(e02.atMs).toBeLessThan(e03.atMs);
  });
});
