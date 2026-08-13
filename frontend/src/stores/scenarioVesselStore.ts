import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SCENARIO_VESSELS, type ScenarioVesselId } from "../data/scenarioVessels";
import type { SpeedSegment } from "../calculations/scenarioCalculations";

export type ScenarioVesselStatus = "PLANNED" | "SAILING" | "WAITING" | "BERTHED" | "CARGO_OPERATION" | "COMPLETED";

export interface VesselRuntimeState {
  status: ScenarioVesselStatus;
  /** 사용자가 마지막으로 확정한 속도 — 다음 잔여거리 계산의 "빈 구간" 기본값으로 쓴다. 미확정이면 기준속도. */
  currentSpeedKn: number;
  /** 확정 시점부터의 속도 변경 이력. remainingDistanceAt이 이 구간들을 반영해 잔여거리를 계산한다. */
  speedHistory: SpeedSegment[];
}

function initialVesselStates(): Record<ScenarioVesselId, VesselRuntimeState> {
  const result = {} as Record<ScenarioVesselId, VesselRuntimeState>;
  for (const v of SCENARIO_VESSELS) {
    result[v.id] = { status: v.initialStatus, currentSpeedKn: v.baseSpeedKn, speedHistory: [] };
  }
  return result;
}

interface ScenarioVesselStoreState {
  vessels: Record<ScenarioVesselId, VesselRuntimeState>;
  /** 사용자가 사건에 대해 속도를 확정한 시각부터 새 속도 구간을 연다. vesselId는 incidentStore/simulationEvents에서
   * 일반 string으로 넘어오므로 여기서만 느슨하게 받고, 조회 시 알려진 ScenarioVesselId 집합과 대조한다. */
  applySpeedDecision: (vesselId: string, speedKn: number, atIso: string) => void;
  setStatus: (vesselId: string, status: ScenarioVesselStatus) => void;
  reset: () => void;
}

export const useScenarioVesselStore = create<ScenarioVesselStoreState>()(
  persist(
    (set, get) => ({
      vessels: initialVesselStates(),

      applySpeedDecision: (vesselId, speedKn, atIso) => {
        const id = vesselId as ScenarioVesselId;
        const vessel = get().vessels[id];
        if (!vessel) return;
        if (vessel.currentSpeedKn === speedKn && vessel.speedHistory.length === 0) return;

        const closedHistory = vessel.speedHistory.map((seg) => (seg.toIso === null ? { ...seg, toIso: atIso } : seg));
        const speedHistory: SpeedSegment[] = [...closedHistory, { fromIso: atIso, toIso: null, speedKn }];

        set((state) => ({
          vessels: { ...state.vessels, [id]: { ...vessel, currentSpeedKn: speedKn, speedHistory } },
        }));
      },

      setStatus: (vesselId, status) => {
        const id = vesselId as ScenarioVesselId;
        const vessel = get().vessels[id];
        if (!vessel) return;
        set((state) => ({ vessels: { ...state.vessels, [id]: { ...vessel, status } } }));
      },

      reset: () => set({ vessels: initialVesselStates() }),
    }),
    { name: "portpace-scenario-vessels" },
  ),
);
