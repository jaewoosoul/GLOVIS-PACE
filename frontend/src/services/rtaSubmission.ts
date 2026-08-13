import { useNewsStore, type NewsItem, type NewsProcessingStatus } from "../stores/newsStore";
import { analyzeRta, RtaAnalysisRequestError } from "./rtaAnalysisClient";
import type { RtaAnalyzeRequestBody } from "../types/rtaAnalysis";
import { useIncidentStore, type Incident, type IncidentStatus } from "../stores/incidentStore";
import { useAlertsStore } from "../stores/alertsStore";
import type { Signal, SignalGrade } from "../types/signal";

export interface RtaSubmissionInput {
  id: string;
  title: string;
  subtitle: string;
  /** RTA 통보 원문 전체(REF/발신/시각/사건/영향/접안 슬롯 조정 표 등). */
  body: string;
  source: string;
  publishedAtLabel: string;
  publishedAtIso: string;
  /** RTA는 반드시 기존 NEWS 사건을 갱신한다 — incidentStore에 이 사건이 이미 있어야 한다. */
  incidentId: string;
}

/**
 * newsStore에 "접수됨" 상태로 등록만 한다(분석 실행은 runRtaAnalysis에서 별도로 한다).
 * NEWS와 같은 목록·같은 팝업 인프라를 재사용하되 sourceType="RTA"로 명확히 구분한다.
 */
export function registerRtaItem(input: RtaSubmissionInput): RtaAnalyzeRequestBody {
  const item: NewsItem = {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    source: input.source || "항만 당국",
    publishedAtLabel: input.publishedAtLabel || "-",
    submittedAt: input.publishedAtIso,
    status: "접수됨",
    sourceType: "RTA",
    incidentId: input.incidentId,
  };
  useNewsStore.getState().addNews(item);

  return { id: input.id, text: input.body };
}

const STATUS_BY_INCIDENT_STATUS: Partial<Record<IncidentStatus, NewsProcessingStatus>> = {
  VERIFIED_UNCHANGED: "확정치 일치",
  REVIEW_REQUIRED_INCREASED_DELAY: "재검토 필요(지연 증가)",
  REVIEW_REQUIRED_REDUCED_DELAY: "재검토 필요(지연 감소)",
};

const GRADE_BY_INCIDENT_STATUS: Partial<Record<IncidentStatus, SignalGrade>> = {
  VERIFIED_UNCHANGED: "정상화 신호",
  REVIEW_REQUIRED_INCREASED_DELAY: "긴급",
  REVIEW_REQUIRED_REDUCED_DELAY: "정상화 신호",
};

/**
 * RTA도 NEWS와 마찬가지로 "판단 대기 사건"(운항 판단 페이지 상단 목록)에 올라와야 확인·재확정을
 * 놓치지 않는다 — RTA는 그동안 /news의 "운항 판단 비교" 섹션에서만 보여 눈에 잘 안 띄었다.
 * signal.id는 RTA 이벤트 자체의 id(예: "R-01")를 그대로 써서 NEWS 신호(예: "E-01")와 겹치지 않는다.
 */
function buildSignalFromRta(rtaEventId: string, incident: Incident): Signal {
  const grade = GRADE_BY_INCIDENT_STATUS[incident.status] ?? "정상화 신호";
  return {
    id: rtaEventId,
    title: `${incident.portName} 항만 RTA 확정 통보 — ${STATUS_BY_INCIDENT_STATUS[incident.status] ?? "확정치 일치"}`,
    occurredAtLabel: incident.rtaReceivedAtIso
      ? new Date(incident.rtaReceivedAtIso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : "-",
    port: incident.portName,
    grade,
    reason: incident.rtaAnalysis?.incidentSummary ?? incident.newsAnalysis?.summary,
    sourceReliability: "높음",
    affectedVesselCount: incident.confirmedDelayByVessel.length,
    processingStatus: "판단 필요",
    hasFullAnalysis: true,
    trigger: "PORT_DISRUPTION",
    linkedIncidentId: incident.incidentId,
  };
}

export type RtaAnalysisOutcome = { ok: true } | { ok: false; message: string };

/**
 * 접수된 RTA에 Claude 분석(/api/rta/analyze)을 실행하고, incidentStore.upsertRtaAnalysis로
 * 같은 incidentId의 기존 NEWS 사건을 갱신한다 — 새 사건을 만들지 않는다.
 */
export async function runRtaAnalysis(id: string, incidentId: string, request: RtaAnalyzeRequestBody, receivedAtIso: string): Promise<RtaAnalysisOutcome> {
  useNewsStore.getState().updateStatus(id, { status: "AI 분석 중" });
  try {
    const analysis = await analyzeRta(request);
    useIncidentStore.getState().upsertRtaAnalysis({ incidentId, rtaAnalysis: analysis, receivedAtIso });

    const incident = useIncidentStore.getState().incidents[incidentId];
    const status: NewsProcessingStatus = (incident && STATUS_BY_INCIDENT_STATUS[incident.status]) || "확정치 일치";
    useNewsStore.getState().updateStatus(id, {
      status,
      relatedPort: analysis.portCanonicalName ?? analysis.portMentionedName,
      rtaAnalysis: analysis,
      analysisError: undefined,
    });
    // 확인/재확정할 선박이 하나도 안 남은 채 곧바로 COMPLETED가 된 경우(예: 전부 UNMATCHED)만
    // 판단 대기열에 올리지 않는다 — 그 외에는 항상 "판단 대기 사건"에 넣는다.
    if (incident && incident.status !== "COMPLETED") {
      useAlertsStore.getState().addAlert(buildSignalFromRta(id, incident));
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof RtaAnalysisRequestError ? err.message : "AI 분석 요청 중 오류가 발생했습니다.";
    useNewsStore.getState().updateStatus(id, { status: "분석 실패", analysisError: message });
    return { ok: false, message };
  }
}

/**
 * RTA로 만든 판단 대기 신호는 사건의 모든 선박이 재확정(revisionConfirmed)돼 incident.status가
 * COMPLETED로 바뀌는 순간 자동으로 큐에서 내린다 — incidentStore 쪽에서 이 파일을 import하면
 * 순환 의존이 생기므로 반대 방향(구독)으로 둔다.
 */
useIncidentStore.subscribe((state, prevState) => {
  for (const incidentId of Object.keys(state.incidents)) {
    const incident = state.incidents[incidentId];
    const prevIncident = prevState.incidents[incidentId];
    if (incident.status !== "COMPLETED" || prevIncident?.status === "COMPLETED") continue;
    for (const alert of useAlertsStore.getState().alerts) {
      if (alert.linkedIncidentId === incidentId) useAlertsStore.getState().resolveAlert(alert.id);
    }
  }
});
