import { create } from "zustand";
import { useDecisionStore } from "./decisionStore";

export type MapMode = "FLEET_OVERVIEW" | "DECISION_DRAFT" | "EXECUTING";

/**
 * 화면 전환은 React Router가 담당한다. 이 스토어는 라우트를 넘나들며 유지해야 하는
 * "판단 세션" 상태(어떤 사건/선박을 보고 있는가, 지도 포커스)만 다룬다.
 */
interface WorkflowStoreState {
  selectedIncidentId: string | null;
  selectedVesselId: string | null;
  focusedVesselId: string | null;
  focusedPortId: string | null;

  /** 다중 선박 사건(incidentStore)에서 검토 대상 선박을 바꾼다. DRAFT 상태일 때만 허용하고, 해당 선박 기준으로 판단을 다시 초기화한다. */
  switchVessel: (vesselId: string) => void;
  focusVessel: (vesselId: string | null) => void;
  focusPort: (portId: string | null) => void;
  /** 시뮬레이션 "초기화" 시 호출된다 — 판단/실행 세션 흔적(선택된 사건·선박, 지도 포커스)을 전부 지운다. */
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowStoreState>((set) => ({
  selectedIncidentId: null,
  selectedVesselId: null,
  focusedVesselId: null,
  focusedPortId: null,

  switchVessel: (vesselId) => {
    if (useDecisionStore.getState().decisionStatus !== "DRAFT") return;
    useDecisionStore.getState().resetForMode("SLOW_DOWN");
    set({ selectedVesselId: vesselId });
  },

  focusVessel: (vesselId) => set({ focusedVesselId: vesselId }),
  focusPort: (portId) => set({ focusedPortId: portId }),

  reset: () =>
    set({
      selectedIncidentId: null,
      selectedVesselId: null,
      focusedVesselId: null,
      focusedPortId: null,
    }),
}));
