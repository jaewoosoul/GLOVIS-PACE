import { useNewsStore, type NewsItem } from "../stores/newsStore";
import { useAlertsStore } from "../stores/alertsStore";
import { VESSELS } from "../data/fleetData";
import { analyzeNews, NewsAnalysisRequestError } from "./newsAnalysisClient";
import type { DecisionReadiness, NewsAnalysis, NewsAnalyzeRequestBody } from "../types/newsAnalysis";
import type { Signal } from "../types/signal";
import type { NoiseFilterReason } from "../data/simulationEvents";

export const READINESS_TO_STATUS: Record<DecisionReadiness, NewsItem["status"]> = {
  READY: "운항 영향 있음",
  // MONITOR_ONLY도 NO_IMPACT와 마찬가지로 알림·판단 카드를 만들지 않는다 — 화면에서 액션 가능 여부
  // 기준으로는 둘을 구분할 이유가 없어 같은 라벨로 합친다. INSUFFICIENT_INFORMATION만 "판단할
  // 근거가 부족하다"는 별개의 의미라 구분해서 보여준다.
  MONITOR_ONLY: "영향 없음",
  INSUFFICIENT_INFORMATION: "정보 부족",
  NO_IMPACT: "영향 없음",
};

export function confidenceBucket(confidence: number): "높음" | "중간" | "낮음" {
  if (confidence >= 0.75) return "높음";
  if (confidence >= 0.4) return "중간";
  return "낮음";
}

export interface NewsSubmissionInput {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  source: string;
  publishedAtLabel: string;
  publishedAtIso: string;
  /** 시뮬레이션 타임라인 이벤트로 등록될 때만 채워진다 — 같은 사건의 RTA가 이 값으로 갱신 대상을 찾는다. */
  incidentId?: string;
  /** 노이즈 시뮬레이션 이벤트에서만 채워진다 — 코드가 미리 판정해둔 결정론적 필터 사유(§7). */
  filteredBy?: NoiseFilterReason;
  filterReason?: string;
}

/**
 * newsStore에 "접수됨" 상태로 등록만 한다(분석 실행은 runNewsAnalysis에서 별도로 한다).
 * 시뮬레이션 이벤트(simulationStore)가 뉴스/RTA 이벤트를 재생할 때 이 함수를 호출한다.
 */
export function registerNewsItem(input: NewsSubmissionInput): NewsAnalyzeRequestBody {
  const item: NewsItem = {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
    source: input.source || "-",
    publishedAtLabel: input.publishedAtLabel || "-",
    submittedAt: input.publishedAtIso,
    status: "접수됨",
    sourceType: "NEWS",
    incidentId: input.incidentId,
    filteredBy: input.filteredBy,
    filterReason: input.filterReason,
  };
  useNewsStore.getState().addNews(item);

  return {
    id: input.id,
    title: input.title,
    content: input.body,
    source: input.source || undefined,
    publishedAt: input.publishedAtIso,
    language: "ko",
  };
}

function resolveTrigger(analysis: NewsAnalysis): NonNullable<Signal["trigger"]> {
  return analysis.eventType === "BERTH_OPENING" || analysis.eventType === "PORT_RECOVERY"
    ? "BERTH_SLOT_OPPORTUNITY"
    : "PORT_DISRUPTION";
}

/** 뉴스가 언급한 항만이 자사 선박의 항로(route)에 포함되는지로 영향 선박 수를 어림잡는다. */
function countAffectedVessels(analysis: NewsAnalysis): number {
  const portNames = analysis.affectedPorts
    .map((p) => (p.canonicalName ?? p.mentionedName).toLowerCase())
    .filter((name) => name.length > 0);
  if (portNames.length === 0) return 0;
  return VESSELS.filter((v) => v.route.some((port) => portNames.some((name) => port.toLowerCase().includes(name) || name.includes(port.toLowerCase())))).length;
}

/** AI 분석이 "판단 필요"로 판정한 뉴스만 운항 판단 대기열(alertsStore)에 신호로 등록한다. */
function buildSignalFromAnalysis(item: NewsItem, analysis: NewsAnalysis): Signal {
  const trigger = resolveTrigger(analysis);
  return {
    id: item.id,
    title: item.title,
    occurredAtLabel: new Date(item.submittedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    port: analysis.affectedPorts[0]?.canonicalName ?? analysis.affectedPorts[0]?.mentionedName ?? "-",
    grade: trigger === "BERTH_SLOT_OPPORTUNITY" ? "운항 기회" : "긴급",
    reason: analysis.summary,
    sourceReliability: confidenceBucket(analysis.confidence),
    estimatedDurationHours: analysis.timing.reportedDurationHours?.max ?? analysis.timing.reportedDurationHours?.min ?? undefined,
    affectedVesselCount: countAffectedVessels(analysis),
    processingStatus: "판단 필요",
    hasFullAnalysis: true,
    trigger,
    linkedIncidentId: item.incidentId,
  };
}

function applyAnalysisResult(id: string, analysis: NewsAnalysis): void {
  useNewsStore.getState().updateStatus(id, {
    status: READINESS_TO_STATUS[analysis.decisionReadiness],
    aiVerdict: analysis.summary,
    aiConfidence: confidenceBucket(analysis.confidence),
    relatedPort: analysis.affectedPorts[0]?.canonicalName ?? analysis.affectedPorts[0]?.mentionedName,
    analysis,
    analysisError: undefined,
  });

  if (analysis.decisionReadiness !== "READY") return;

  const item = useNewsStore.getState().items.find((n) => n.id === id);
  if (!item) return;

  const signal = buildSignalFromAnalysis(item, analysis);
  useAlertsStore.getState().addAlert(signal);
  useNewsStore.getState().updateStatus(id, { linkedAlertId: signal.id });
}

function applyAnalysisError(id: string, err: unknown): string {
  const message = err instanceof NewsAnalysisRequestError ? err.message : "AI 분석 요청 중 오류가 발생했습니다.";
  useNewsStore.getState().updateStatus(id, { status: "분석 실패", analysisError: message });
  return message;
}

export type NewsAnalysisOutcome = { ok: true } | { ok: false; message: string };

/** 접수된 뉴스에 Claude 분석(기존 /api/news/analyze 흐름)을 실행하고 결과를 newsStore에 반영한다. */
export async function runNewsAnalysis(id: string, request: NewsAnalyzeRequestBody): Promise<NewsAnalysisOutcome> {
  useNewsStore.getState().updateStatus(id, { status: "AI 분석 중" });
  try {
    const analysis = await analyzeNews(request);
    applyAnalysisResult(id, analysis);
    return { ok: true };
  } catch (err) {
    const message = applyAnalysisError(id, err);
    return { ok: false, message };
  }
}
