import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Signal } from "../types/signal";

/**
 * 앱 시작 시 비어 있는 "운항 판단 대기열". 뉴스가 실제로 접수·분석되어 운항에 영향이 있다고
 * 판정된 경우에만 addAlert()로 이 목록에 들어온다.
 * newsStore/incidentStore와 마찬가지로 localStorage에 persist한다 — 그렇지 않으면 뉴스는
 * 그대로 남아있는데 새로고침 한 번에 판단 대기열만 비어버리는 불일치가 생긴다.
 */
interface AlertsState {
  alerts: Signal[];
  resolvedAlertIds: string[];

  addAlert: (signal: Signal) => void;
  resolveAlert: (id: string) => void;
  reset: () => void;
}

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      resolvedAlertIds: [],

      addAlert: (signal) => {
        if (get().alerts.some((a) => a.id === signal.id)) return;
        set((state) => ({ alerts: [...state.alerts, signal] }));
      },

      resolveAlert: (id) =>
        set((state) => ({
          resolvedAlertIds: state.resolvedAlertIds.includes(id) ? state.resolvedAlertIds : [...state.resolvedAlertIds, id],
        })),

      reset: () => set({ alerts: [], resolvedAlertIds: [] }),
    }),
    { name: "portpace-alerts" },
  ),
);

export function selectPendingAlerts(state: AlertsState): Signal[] {
  return state.alerts.filter(
    (a) => a.hasFullAnalysis && a.processingStatus === "판단 필요" && !state.resolvedAlertIds.includes(a.id),
  );
}
