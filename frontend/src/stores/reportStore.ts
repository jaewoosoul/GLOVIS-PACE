import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompletedDecisionRecord } from "../types/report";

/**
 * "완료된 운항 판단" 이력. decisionStore/incidentStore는 활성 판단 1건 또는 사건 단위 상태만 들고
 * 있고 완료 이후의 기록을 남기지 않으므로, 리포트 페이지를 위해 별도로 영속 저장한다.
 * calculations/reportRecordBuilder.ts가 완료 시점마다 레코드를 만들어 addRecord로 여기 쌓는다.
 */
interface ReportState {
  records: CompletedDecisionRecord[];
  addRecord: (record: CompletedDecisionRecord) => void;
  reset: () => void;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      records: [],
      addRecord: (record) => {
        if (get().records.some((r) => r.id === record.id)) return;
        set((state) => ({ records: [record, ...state.records] }));
      },
      reset: () => set({ records: [] }),
    }),
    { name: "portpace-report-records" },
  ),
);
