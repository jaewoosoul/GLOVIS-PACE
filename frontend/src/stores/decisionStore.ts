import { create } from "zustand";
import type { DecisionMode, DecisionStatus, SpeedOptionId } from "../types/decision";
import {
  DEFAULT_PORT_DELAY_HOURS,
  DEFAULT_MIN_ARRIVAL_BUFFER_MINUTES,
  SHANGHAI_BERTH_OPPORTUNITY,
} from "../data/scenarios";
import { REVOKE_WINDOW_REAL_MS } from "../lib/useCountdown";
import { useExecutionRecordsStore, buildRecordId, type ExecutionRecord } from "./executionRecordsStore";

interface DecisionStoreState {
  /** SLOW_DOWN(감속)과 SPEED_UP(증속)은 입력 UI와 판단 기준이 섞이지 않도록 서로 다른 필드를 쓴다. */
  decisionMode: DecisionMode;

  // --- SLOW_DOWN 전용 입력 ---
  delayAssumptionHours: number;

  // --- SPEED_UP 전용 입력 (담당자가 수정 가능한 선석 조건) ---
  berthCutoffOverrideAt: string;
  nextAvailableWaitHoursOverride: number;
  minArrivalBufferMinutesOverride: number;

  selectedOptionId: SpeedOptionId;
  isHeld: boolean;

  // 판단(DRAFT) 단계 모달
  reviewModalOpen: boolean;
  approvalModalOpen: boolean;

  // 승인/실행 상태 모델 — 지금 화면에 띄운 선박 1건의 "뷰"일 뿐이며, 영속 원본은
  // executionRecordsStore에 있다(activeRecordId로 그 레코드를 가리킨다).
  activeRecordId: string | null;
  decisionStatus: DecisionStatus;
  approvedAt: number | null;
  revokeDeadlineAt: number | null;
  executionClickCount: number;
  revokeConfirmOpen: boolean;

  setDelayAssumptionHours: (hours: number) => void;
  setBerthCutoffOverrideAt: (label: string) => void;
  setNextAvailableWaitHoursOverride: (hours: number) => void;
  setMinArrivalBufferMinutesOverride: (minutes: number) => void;
  selectOption: (optionId: SpeedOptionId) => void;
  reset: () => void;
  resetForMode: (mode: DecisionMode) => void;
  /** 이미 승인된 선박을 다시 보러 왔을 때(상세 보기) — DRAFT로 되돌리지 않고 그 레코드를 그대로 불러온다. */
  loadRecord: (record: ExecutionRecord) => void;
  hold: () => void;

  openReviewModal: () => void;
  cancelReviewModal: () => void;
  confirmApproval: (target: { incidentId: string | null; vesselId: string }) => void;
  closeApprovalModal: () => void;

  advanceExecution: () => void;

  openRevokeConfirm: () => void;
  cancelRevokeConfirm: () => void;
  confirmRevoke: () => void;
}

const DRAFT_DEFAULTS = {
  activeRecordId: null as string | null,
  decisionStatus: "DRAFT" as DecisionStatus,
  approvedAt: null,
  revokeDeadlineAt: null,
  executionClickCount: 0,
  revokeConfirmOpen: false,
  reviewModalOpen: false,
  approvalModalOpen: false,
};

function inputDefaultsForMode(mode: DecisionMode) {
  return {
    decisionMode: mode,
    delayAssumptionHours: DEFAULT_PORT_DELAY_HOURS,
    berthCutoffOverrideAt: SHANGHAI_BERTH_OPPORTUNITY.windowEndAt,
    nextAvailableWaitHoursOverride: SHANGHAI_BERTH_OPPORTUNITY.nextAvailableWaitHours,
    minArrivalBufferMinutesOverride: DEFAULT_MIN_ARRIVAL_BUFFER_MINUTES,
    selectedOptionId: "C" as SpeedOptionId,
    isHeld: false,
  };
}

export const useDecisionStore = create<DecisionStoreState>((set, get) => ({
  ...inputDefaultsForMode("SLOW_DOWN"),
  ...DRAFT_DEFAULTS,

  setDelayAssumptionHours: (hours) =>
    set((state) => (state.decisionStatus !== "DRAFT" ? state : { delayAssumptionHours: hours, isHeld: false })),
  setBerthCutoffOverrideAt: (label) =>
    set((state) => (state.decisionStatus !== "DRAFT" ? state : { berthCutoffOverrideAt: label, isHeld: false })),
  setNextAvailableWaitHoursOverride: (hours) =>
    set((state) => (state.decisionStatus !== "DRAFT" ? state : { nextAvailableWaitHoursOverride: hours, isHeld: false })),
  setMinArrivalBufferMinutesOverride: (minutes) =>
    set((state) => (state.decisionStatus !== "DRAFT" ? state : { minArrivalBufferMinutesOverride: minutes, isHeld: false })),
  selectOption: (optionId) =>
    set((state) => (state.decisionStatus !== "DRAFT" ? state : { selectedOptionId: optionId, isHeld: false })),
  reset: () => set({ ...inputDefaultsForMode("SLOW_DOWN"), ...DRAFT_DEFAULTS }),
  resetForMode: (mode) => set({ ...inputDefaultsForMode(mode), ...DRAFT_DEFAULTS }),
  loadRecord: (record) =>
    set({
      decisionMode: record.decisionMode,
      delayAssumptionHours: record.delayAssumptionHours,
      berthCutoffOverrideAt: record.berthCutoffOverrideAt,
      nextAvailableWaitHoursOverride: record.nextAvailableWaitHoursOverride,
      minArrivalBufferMinutesOverride: record.minArrivalBufferMinutesOverride,
      selectedOptionId: record.selectedOptionId,
      isHeld: false,
      reviewModalOpen: false,
      approvalModalOpen: false,
      activeRecordId: record.recordId,
      decisionStatus: record.decisionStatus,
      approvedAt: record.approvedAt,
      revokeDeadlineAt: record.revokeDeadlineAt,
      executionClickCount: record.executionClickCount,
      revokeConfirmOpen: false,
    }),
  hold: () => set({ isHeld: true }),

  openReviewModal: () => set((state) => (state.decisionStatus !== "DRAFT" ? state : { reviewModalOpen: true })),
  cancelReviewModal: () => set({ reviewModalOpen: false }),
  confirmApproval: ({ incidentId, vesselId }) => {
    const state = get();
    const recordId = buildRecordId(incidentId, vesselId);
    const approvedAt = Date.now();
    const revokeDeadlineAt = approvedAt + REVOKE_WINDOW_REAL_MS;

    const record: ExecutionRecord = {
      recordId,
      incidentId,
      vesselId,
      decisionMode: state.decisionMode,
      selectedOptionId: state.selectedOptionId,
      delayAssumptionHours: state.delayAssumptionHours,
      berthCutoffOverrideAt: state.berthCutoffOverrideAt,
      nextAvailableWaitHoursOverride: state.nextAvailableWaitHoursOverride,
      minArrivalBufferMinutesOverride: state.minArrivalBufferMinutesOverride,
      decisionStatus: "APPROVED",
      approvedAt,
      revokeDeadlineAt,
      executionClickCount: 0,
    };
    useExecutionRecordsStore.getState().upsert(record);

    set({
      reviewModalOpen: false,
      approvalModalOpen: true,
      activeRecordId: recordId,
      decisionStatus: "APPROVED",
      approvedAt,
      revokeDeadlineAt,
      executionClickCount: 0,
    });
  },
  closeApprovalModal: () => set({ approvalModalOpen: false }),

  advanceExecution: () => {
    const { activeRecordId } = get();
    if (!activeRecordId) return;
    useExecutionRecordsStore.getState().advance(activeRecordId);
    // 아래 executionRecordsStore 구독이 동기적으로 decisionStatus/executionClickCount를 반영한다.
  },

  openRevokeConfirm: () => set({ revokeConfirmOpen: true }),
  cancelRevokeConfirm: () => set({ revokeConfirmOpen: false }),
  confirmRevoke: () => {
    const { activeRecordId, decisionMode } = get();
    if (activeRecordId) useExecutionRecordsStore.getState().remove(activeRecordId);
    set({ ...inputDefaultsForMode(decisionMode), ...DRAFT_DEFAULTS });
  },
}));

/**
 * decisionStore는 executionRecordsStore(영속 원본)의 "지금 보고 있는 레코드"만 비추는 거울이다.
 * 다른 화면(실행 요약 목록의 개별 철회 등)이 executionRecordsStore를 직접 바꿔도 이 구독이
 * 동기적으로 반영하거나(진행률·완료 전환), 레코드가 사라졌으면(철회) DRAFT로 되돌린다.
 */
useExecutionRecordsStore.subscribe((state) => {
  const { activeRecordId, decisionMode } = useDecisionStore.getState();
  if (!activeRecordId) return;
  const record = state.records[activeRecordId];
  if (!record) {
    useDecisionStore.setState({ ...inputDefaultsForMode(decisionMode), ...DRAFT_DEFAULTS });
    return;
  }
  const current = useDecisionStore.getState();
  if (current.decisionStatus !== record.decisionStatus || current.executionClickCount !== record.executionClickCount) {
    useDecisionStore.setState({ decisionStatus: record.decisionStatus, executionClickCount: record.executionClickCount });
  }
});
