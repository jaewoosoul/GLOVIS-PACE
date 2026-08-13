import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SIMULATION_EVENTS, SIMULATION_START_MS, type SimulationEvent } from "../data/simulationEvents";
import { registerNewsItem, runNewsAnalysis } from "../services/newsSubmission";
import { registerRtaItem, runRtaAnalysis } from "../services/rtaSubmission";
import { useNewsStore } from "./newsStore";
import { useAlertsStore } from "./alertsStore";
import { useIncidentStore } from "./incidentStore";
import { useScenarioVesselStore } from "./scenarioVesselStore";
import { useReportStore } from "./reportStore";
import { useDecisionStore } from "./decisionStore";
import { useWorkflowStore } from "./workflowStore";
import { useExecutionRecordsStore } from "./executionRecordsStore";

export interface SimulationLogEntry {
  eventId: string;
  atMs: number;
  label: string;
  sourceType: SimulationEvent["sourceType"];
}

interface SimulationState {
  /** 가상 절대시각(ms) — 마지막으로 실행한 이벤트 시각까지만 전진한다. 배속/자동재생 없이 "다음 이벤트"를 누를 때만 바뀐다. */
  currentSimTime: number;
  /** 새로고침/페이지 이동 후에도 유지되어(persist) 이미 실행한 이벤트가 중복 등록되지 않게 막는다. */
  executedEventIds: string[];
  eventLog: SimulationLogEntry[];
  /** 방금 실행한 이벤트 id — 상단 배너에 "방금 발생" 안내로 잠깐 보여준다. */
  activeEventId: string | null;
  /** "다음 이벤트" 클릭 후 Claude 분석이 끝날 때까지 true — 버튼에 로딩 상태를 보여주고 중복 클릭을 막는다. */
  isProcessingEvent: boolean;

  reset: () => void;
  /** 다음 미실행 이벤트를 즉시 실행한다(뉴스면 그 자리에서 Claude 분석까지 기다린다) — 더 이상 시계를 재생해 흘려보내지 않는다. */
  triggerNextEvent: () => Promise<void>;
}

function upcomingSortedEvents(executedEventIds: string[]): SimulationEvent[] {
  return [...SIMULATION_EVENTS].filter((e) => !executedEventIds.includes(e.eventId)).sort((a, b) => a.atMs - b.atMs);
}

/** 이벤트 발생 시각을 "MM/DD HH:mm" 라벨로 변환한다(KST 고정, NewsItem.publishedAtLabel 표시용). */
function formatKstLabel(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * NEWS/RTA는 기존 Claude 분석 파이프라인(registerNewsItem+runNewsAnalysis / registerRtaItem+runRtaAnalysis)을
 * 그대로 재사용한다. NEWS 분석이 끝나면 incidentStore에 잠정 사건으로 등록해 RTA가 갱신할 대상을 만든다.
 * 노이즈도 같은 뉴스 파이프라인을 태워 뉴스 목록에는 올리되(§7: "노이즈도 Claude 파싱은 수행"),
 * incidentId가 없어 위 사건 갱신 로직은 자연히 건너뛴다 — Claude의 판정과 별개로, event.filteredBy에
 * 미리 담아둔 결정론적 사유(§7 TriageResult)를 뉴스 카드에 그대로 실어 보낸다.
 */
async function executeEvent(event: SimulationEvent): Promise<void> {
  if ((event.sourceType === "NEWS" || event.sourceType === "NOISE") && event.payload) {
    const request = registerNewsItem({
      id: event.eventId,
      title: event.payload.title,
      subtitle: event.payload.subtitle,
      body: event.payload.body,
      source: event.payload.source,
      publishedAtLabel: formatKstLabel(event.atMs),
      publishedAtIso: new Date(event.atMs).toISOString(),
      incidentId: event.incidentId ?? undefined,
      filteredBy: event.filteredBy,
      filterReason: event.filterReason,
    });
    const outcome = await runNewsAnalysis(event.eventId, request);
    if (!outcome.ok || !event.incidentId || !event.portCode || !event.portName) return;
    const item = useNewsStore.getState().items.find((i) => i.id === event.eventId);
    if (!item?.analysis) return;
    useIncidentStore.getState().upsertNewsAnalysis({
      incidentId: event.incidentId,
      portCode: event.portCode,
      portName: event.portName,
      newsAnalysis: item.analysis,
      receivedAtIso: new Date(event.atMs).toISOString(),
    });
    // §2/§7: 관련 선박은 AI가 아니라 코드(항만 코드 + 선박 스케줄 대조)가 최종 판정한다. 이 사건은
    // 애초에 시나리오 데이터에 incidentId/portCode가 박혀 있어 코드 경로가 항상 실행되므로, 코드가
    // 실제로 대상 선박을 찾았다면 Claude의 개별 판독(decisionReadiness)이 "영향 없음"으로 나왔더라도
    // 뉴스 카드 상태를 코드의 판정에 맞춰 덮어써 화면이 서로 모순되지 않게 한다.
    const hasMatchedVessels = (useIncidentStore.getState().incidents[event.incidentId]?.provisionalByVessel.length ?? 0) > 0;
    if (hasMatchedVessels && item.status !== "운항 영향 있음") {
      useNewsStore.getState().updateStatus(event.eventId, { status: "운항 영향 있음" });
    }
    return;
  }

  if (event.sourceType === "RTA" && event.incidentId && event.payload) {
    const request = registerRtaItem({
      id: event.eventId,
      title: event.payload.title,
      subtitle: event.payload.subtitle,
      body: event.payload.body,
      source: event.payload.source,
      publishedAtLabel: formatKstLabel(event.atMs),
      publishedAtIso: new Date(event.atMs).toISOString(),
      incidentId: event.incidentId,
    });
    await runRtaAnalysis(event.eventId, event.incidentId, request, new Date(event.atMs).toISOString());
    return;
  }

  if (event.sourceType === "VESSEL" && event.vesselEvent) {
    useScenarioVesselStore.getState().setStatus(event.vesselEvent.vesselId, event.vesselEvent.status);
  }
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      currentSimTime: SIMULATION_START_MS,
      executedEventIds: [],
      eventLog: [],
      activeEventId: null,
      isProcessingEvent: false,

      reset: () => {
        set({
          currentSimTime: SIMULATION_START_MS,
          executedEventIds: [],
          eventLog: [],
          activeEventId: null,
          isProcessingEvent: false,
        });
        useNewsStore.getState().reset();
        useAlertsStore.getState().reset();
        useIncidentStore.getState().reset();
        useScenarioVesselStore.getState().reset();
        useReportStore.getState().reset();
        // "실행 및 모니터링" 카드가 초기화 후에도 남아있던 원인 — decisionStore(활성 판단 상태)와
        // workflowStore(선택된 사건/선박)는 새로고침 없이는 초기화되지 않아 이전 승인 상태가 그대로 보였다.
        useDecisionStore.getState().reset();
        useWorkflowStore.getState().reset();
        // 승인된 여러 선박의 영속 스냅샷("실행 및 모니터링"/"최근 운항 결정")도 함께 지운다.
        useExecutionRecordsStore.getState().reset();
      },

      triggerNextEvent: async () => {
        if (get().isProcessingEvent) return;
        const next = upcomingSortedEvents(get().executedEventIds)[0];
        if (!next) return;

        set({ isProcessingEvent: true, activeEventId: next.eventId });
        try {
          await executeEvent(next);
        } finally {
          set((state) => ({
            currentSimTime: next.atMs,
            executedEventIds: [...state.executedEventIds, next.eventId],
            eventLog: [{ eventId: next.eventId, atMs: next.atMs, label: next.label, sourceType: next.sourceType }, ...state.eventLog],
            isProcessingEvent: false,
          }));
        }
      },
    }),
    {
      name: "portpace-simulation-clock",
      partialize: (state) => ({
        currentSimTime: state.currentSimTime,
        executedEventIds: state.executedEventIds,
        eventLog: state.eventLog,
        // isProcessingEvent/activeEventId는 의도적으로 제외한다 — 새로고침 후 진행 중이던 로딩
        // 상태가 영구히 남지 않게 한다.
      }),
    },
  ),
);
