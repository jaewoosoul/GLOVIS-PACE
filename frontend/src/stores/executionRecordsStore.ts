import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DecisionMode, DecisionStatus, SpeedOptionId } from "../types/decision";

const MAX_EXECUTION_CLICKS = 4;

/**
 * 승인된 판단 1건의 영속 스냅샷. decisionStore는 "지금 화면에 띄운 선박 1건"만 다루는 세션
 * 상태라 여러 선박이 동시에 승인되면 마지막 것만 남았다 — 그래서 "실행 및 모니터링"/"최근 운항
 * 결정"에 표시할 데이터는 decisionStore가 아니라 이 스토어(사건+선박별로 독립된 레코드)에서 읽는다.
 */
export interface ExecutionRecord {
  recordId: string;
  /** 사건 기반 판단이면 incidentStore의 incidentId, 레거시 데모 신호 판단이면 null. */
  incidentId: string | null;
  vesselId: string;
  decisionMode: DecisionMode;
  selectedOptionId: SpeedOptionId;
  delayAssumptionHours: number;
  berthCutoffOverrideAt: string;
  nextAvailableWaitHoursOverride: number;
  minArrivalBufferMinutesOverride: number;
  decisionStatus: DecisionStatus;
  approvedAt: number;
  revokeDeadlineAt: number;
  executionClickCount: number;
}

interface ExecutionRecordsState {
  records: Record<string, ExecutionRecord>;
  upsert: (record: ExecutionRecord) => void;
  advance: (recordId: string) => void;
  /** RTA 재확정(incidentStore.confirmRevision) 등, 실행 4단계 클릭과 무관하게 이 선박의 판단이
   * 최종 확정됐다는 신호가 오면 즉시 COMPLETED로 넘긴다 — 그렇지 않으면 "RTA는 확정했는데
   * 대시보드는 여전히 실행 중"이라는 모순이 생긴다. */
  complete: (recordId: string) => void;
  remove: (recordId: string) => void;
  reset: () => void;
}

/** incidentId+vesselId(또는 레거시는 vesselId만)로 레코드를 고유하게 식별한다. */
export function buildRecordId(incidentId: string | null, vesselId: string): string {
  return `${incidentId ?? "solo"}::${vesselId}`;
}

export const useExecutionRecordsStore = create<ExecutionRecordsState>()(
  persist(
    (set) => ({
      records: {},

      upsert: (record) => set((state) => ({ records: { ...state.records, [record.recordId]: record } })),

      advance: (recordId) =>
        set((state) => {
          const record = state.records[recordId];
          if (!record || record.decisionStatus === "DRAFT") return state;
          const next = Math.min(MAX_EXECUTION_CLICKS, record.executionClickCount + 1);
          const decisionStatus: DecisionStatus = next >= MAX_EXECUTION_CLICKS ? "MONITORING" : "EXECUTING";
          return { records: { ...state.records, [recordId]: { ...record, executionClickCount: next, decisionStatus } } };
        }),

      complete: (recordId) =>
        set((state) => {
          const record = state.records[recordId];
          if (!record || record.decisionStatus === "COMPLETED") return state;
          return { records: { ...state.records, [recordId]: { ...record, decisionStatus: "COMPLETED", executionClickCount: MAX_EXECUTION_CLICKS } } };
        }),

      remove: (recordId) =>
        set((state) => {
          const { [recordId]: _removed, ...rest } = state.records;
          return { records: rest };
        }),

      reset: () => set({ records: {} }),
    }),
    { name: "portpace-execution-records-v1" },
  ),
);

/**
 * MONITORING(목표 속도 도달) 상태에서 철회 가능 시간(revokeDeadlineAt)이 지나면 COMPLETED로
 * 전환한다 — 레코드별로 독립 판정하므로 여러 선박이 동시에 모니터링 중이어도 각자 제때 완료된다.
 */
setInterval(() => {
  const { records } = useExecutionRecordsStore.getState();
  const now = Date.now();
  const updates: Record<string, ExecutionRecord> = {};
  for (const record of Object.values(records)) {
    if (record.decisionStatus === "MONITORING" && now >= record.revokeDeadlineAt) {
      updates[record.recordId] = { ...record, decisionStatus: "COMPLETED" };
    }
  }
  if (Object.keys(updates).length > 0) {
    useExecutionRecordsStore.setState((state) => ({ records: { ...state.records, ...updates } }));
  }
}, 250);
