import { useState, type ReactNode } from "react";
import { Loader2, AlertTriangle, Ship, HelpCircle, Clock, AlertOctagon, Radio } from "lucide-react";
import type { NewsItem } from "../../stores/newsStore";
import type {
  AffectedOperation,
  DecisionReadiness,
  HourRange,
  NewsAnalysis,
  NewsEventStatus,
  NewsEventType,
  NewsSeverity,
  OperationalRelevance,
} from "../../types/newsAnalysis";
import { Badge, type BadgeTone } from "../common/Badge";
import type { NoiseFilterReason } from "../../data/simulationEvents";

const FILTERED_BY_LABEL: Record<NoiseFilterReason, string> = {
  PORT_MISMATCH: "항만명 불일치",
  TIME_WINDOW_MISMATCH: "시점 불일치",
  CAUSE_NOT_OPERATIONAL: "사유 유형 무관",
};

const RELEVANCE_LABEL: Record<OperationalRelevance, string> = {
  RELEVANT: "관련 있음",
  MONITOR: "모니터링 대상",
  IRRELEVANT: "관련 없음",
};

const READINESS_LABEL: Record<DecisionReadiness, string> = {
  READY: "즉시 검토 가능",
  MONITOR_ONLY: "모니터링",
  NO_IMPACT: "영향 없음",
  INSUFFICIENT_INFORMATION: "정보 부족",
};
const READINESS_TONE: Record<DecisionReadiness, BadgeTone> = {
  READY: "red",
  MONITOR_ONLY: "yellow",
  NO_IMPACT: "gray",
  INSUFFICIENT_INFORMATION: "gray",
};

const EVENT_TYPE_LABEL: Record<NewsEventType, string> = {
  LABOR_STRIKE: "항만 파업",
  TYPHOON: "태풍",
  PORT_CONGESTION: "항만 혼잡",
  BERTH_CLOSURE: "선석 폐쇄",
  BERTH_OPENING: "임시 선석 개방",
  EQUIPMENT_FAILURE: "장비 고장",
  PORT_CLOSURE: "항만 폐쇄",
  PORT_RECOVERY: "정상화",
  WEATHER_DISRUPTION: "기상 악화",
  PILOTAGE_DISRUPTION: "도선 서비스 중단",
  TOWAGE_DISRUPTION: "예선 서비스 중단",
  OTHER: "기타",
};

const EVENT_STATUS_LABEL: Record<NewsEventStatus, string> = {
  RUMOR: "루머",
  PREDICTED: "예상",
  WATCHING: "예의주시",
  CONFIRMED: "발생 확인",
  ONGOING: "진행 중",
  RECOVERING: "복구 중",
  RESOLVED: "해소됨",
  UNKNOWN: "알 수 없음",
};

const SEVERITY_LABEL: Record<NewsSeverity, string> = {
  NONE: "없음",
  LOW: "낮음",
  MEDIUM: "중간",
  HIGH: "높음",
  CRITICAL: "매우 높음",
};
const SEVERITY_TONE: Record<NewsSeverity, BadgeTone> = {
  NONE: "gray",
  LOW: "gray",
  MEDIUM: "yellow",
  HIGH: "red",
  CRITICAL: "red",
};

const OPERATION_LABEL: Record<AffectedOperation, string> = {
  BERTHING: "접안",
  CARGO_HANDLING: "하역",
  DEPARTURE: "출항",
  PILOTAGE: "도선",
  TOWAGE: "예선",
  ANCHORAGE: "묘박",
  PORT_ENTRY: "입항",
  UNKNOWN: "미상",
};

function formatHourRange(range: HourRange | null): string {
  if (!range) return "정보 없음";
  if (range.max === null) return `최소 ${range.min}시간`;
  if (range.max === range.min) return `${range.min}시간`;
  return `${range.min}~${range.max}시간`;
}

function formatEventTime(iso: string | null, timezone: string | null): string {
  if (!iso) return "정보 없음";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone ?? undefined,
      timeZoneName: timezone ? "short" : undefined,
    }).format(date);
  } catch {
    return date.toLocaleString("ko-KR");
  }
}

function highlightBody(body: string, quote: string | null): ReactNode {
  if (!quote) return body;
  const idx = body.indexOf(quote);
  if (idx === -1) return body;
  return (
    <>
      {body.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5">{quote}</mark>
      {body.slice(idx + quote.length)}
    </>
  );
}

/**
 * 뉴스 페이지의 "AI 분석 결과" 영역에서 재사용하는 카드. NewsItem.status/analysis/analysisError를
 * 그대로 받아 분석 중 / 실패 / 관련 없음 / 관련 있음 상태를 구분해 표시한다.
 */
export function AiAnalysisPanel({ item }: { item: NewsItem }) {
  if (item.status === "AI 분석 중") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 p-4 text-sm font-semibold text-gray-800">
        <Loader2 size={16} className="animate-spin text-blue-500" />
        AI 분석 중
        <span className="font-normal text-gray-400">— 운항 관련성, 영향 항만, 사건 시간을 확인하고 있습니다.</span>
      </div>
    );
  }

  if (item.status === "분석 실패") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} />
          분석 실패
        </div>
        <p className="mt-1 text-xs text-red-600">{item.analysisError ?? "AI 분석 중 오류가 발생했습니다."}</p>
      </div>
    );
  }

  if (!item.analysis) return null;

  const analysis = item.analysis;
  const isIrrelevant = analysis.operationalRelevance === "IRRELEVANT" || analysis.decisionReadiness === "NO_IMPACT";

  if (isIrrelevant) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2">
          <Badge tone="gray">운항 영향 없음</Badge>
          <span className="text-xs text-gray-400">분석 신뢰도 {Math.round(analysis.confidence * 100)}%</span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{analysis.summary}</p>
        {item.filteredBy && (
          <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="font-medium text-gray-700">무관 · {FILTERED_BY_LABEL[item.filteredBy]}</span>
            {item.filterReason && <span className="text-gray-500"> · {item.filterReason}</span>}
          </p>
        )}
        {!item.filteredBy && analysis.exclusionReason && (
          <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <span className="font-medium text-gray-600">판단 미생성 이유: </span>
            {analysis.exclusionReason}
          </p>
        )}
      </div>
    );
  }

  return <RelevantAnalysisCard body={item.body} analysis={analysis} />;
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: BadgeTone }) {
  return (
    <div className="flex min-w-[110px] flex-1 items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500">{label}</p>
        {tone ? (
          <Badge tone={tone}>{value}</Badge>
        ) : (
          <p className="truncate text-sm font-semibold text-gray-800">{value}</p>
        )}
      </div>
    </div>
  );
}

function RelevantAnalysisCard({ body, analysis }: { body: string; analysis: NewsAnalysis }) {
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const notes = Array.from(new Set([...analysis.uncertainties, ...analysis.missingRequiredInformation]));

  return (
    <div>
      {/* 헤더: 판단 가능 여부가 가장 중요한 신호라 배지를 크게, 신뢰도는 보조 정보로 옆에 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={READINESS_TONE[analysis.decisionReadiness]}>{READINESS_LABEL[analysis.decisionReadiness]}</Badge>
        <span className="text-xs text-gray-400">분석 신뢰도 {Math.round(analysis.confidence * 100)}%</span>
      </div>

      {/* Claude 요약 한 줄 — 표를 읽기 전에 먼저 무슨 사건인지 파악할 수 있게 */}
      <p className="mt-2.5 text-sm leading-relaxed text-gray-700">{analysis.summary}</p>

      {/* 핵심 지표 4개를 한 줄로 — 표 대신 카드형으로 훑어보기 쉽게 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Stat icon={<AlertOctagon size={14} />} label="사건 유형" value={EVENT_TYPE_LABEL[analysis.eventType]} />
        <Stat icon={<Radio size={14} />} label="심각도" value={SEVERITY_LABEL[analysis.severity]} tone={SEVERITY_TONE[analysis.severity]} />
        <Stat icon={<Clock size={14} />} label="지속시간" value={formatHourRange(analysis.timing.reportedDurationHours)} />
        <Stat icon={<Ship size={14} />} label="운항 관련성" value={RELEVANCE_LABEL[analysis.operationalRelevance]} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          사건 상태 <span className="font-medium text-gray-700">{EVENT_STATUS_LABEL[analysis.eventStatus]}</span>
        </span>
        <span>
          사건 시작 <span className="font-medium text-gray-700">{formatEventTime(analysis.timing.eventStartAt, analysis.timing.timezone)}</span>
        </span>
      </div>

      {analysis.affectedPorts.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {analysis.affectedPorts.map((port, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-gray-100 px-3 py-2 text-xs">
              <span className="flex items-center gap-1 font-semibold text-gray-800">
                <Ship size={12} className="text-gray-400" />
                {port.canonicalName ?? port.mentionedName}
                {port.unLocode && <span className="font-normal text-gray-400">· {port.unLocode}</span>}
              </span>
              {port.terminal && <span className="text-gray-500">터미널 {port.terminal}</span>}
              {port.affectedOperations.length > 0 && (
                <span className="text-gray-500">{port.affectedOperations.map((op) => OPERATION_LABEL[op]).join(" · ")}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {analysis.evidence.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">판단 근거</p>
          <div className="space-y-1.5">
            {analysis.evidence.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedQuote((prev) => (prev === item.quote ? null : item.quote))}
                className={`block w-full rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedQuote === item.quote ? "border-yellow-300 bg-yellow-100/70" : "border-transparent bg-yellow-50 hover:bg-yellow-100/50"
                }`}
              >
                &ldquo;{item.quote}&rdquo;
              </button>
            ))}
          </div>
          <details className="mt-1.5 text-xs text-gray-500">
            <summary className="cursor-pointer select-none text-gray-400 hover:text-gray-600">원문 보기</summary>
            <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-gray-100 bg-white p-2.5 leading-relaxed text-gray-600">
              {highlightBody(body, selectedQuote)}
            </p>
          </details>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-700">
            <HelpCircle size={12} />
            추가 확인 필요
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
