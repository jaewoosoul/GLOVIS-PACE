import { FileSearch } from "lucide-react";
import type { PortEvent } from "../../types/signal";
import type { DecisionStatus } from "../../types/decision";

export function IncidentRibbon({
  event,
  affectedVesselCount,
  decisionStatus,
  onOpenEvidence,
}: {
  event: PortEvent;
  affectedVesselCount: number;
  decisionStatus: DecisionStatus;
  onOpenEvidence: () => void;
}) {
  const isDraft = decisionStatus === "DRAFT";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${
        isDraft ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"
      }`}
    >
      <span className="text-lg leading-none">{isDraft ? "🔴" : "🔵"}</span>
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
        {isDraft ? (
          <>
            <span className="font-bold text-red-800">{event.news.headline}</span>
            <span className="text-red-700">
              {event.analysis.status} · 최소 {event.analysis.estimatedDurationHours}시간
            </span>
            <span className="text-red-600">출처 신뢰도 {event.analysis.sourceReliability}</span>
            <span className="text-red-600">영향 자사선 {affectedVesselCount}척</span>
          </>
        ) : (
          <>
            <span className="font-bold text-blue-800">운항 변경 승인 완료</span>
            <span className="text-blue-700">
              {decisionStatus === "MONITORING" ? "목표 속도 도달 · 모니터링 중" : "실행 준비 중"}
            </span>
            <span className="text-blue-600">{event.news.headline} · 사건 진행 중</span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenEvidence}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <FileSearch size={13} />
        AI 근거 보기
      </button>
    </div>
  );
}
