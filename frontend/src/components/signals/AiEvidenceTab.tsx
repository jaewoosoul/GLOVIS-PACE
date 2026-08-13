import type { PortEvent } from "../../types/signal";

const ANALYSIS_ROWS: Array<{ key: keyof PortEvent["analysis"]; label: string }> = [
  { key: "port", label: "항만" },
  { key: "eventType", label: "사건 유형" },
  { key: "status", label: "진행 상태" },
  { key: "estimatedDurationHours", label: "예상 지속시간" },
  { key: "sourceReliability", label: "출처 신뢰도" },
];

export function AiEvidenceTab({ event }: { event: PortEvent }) {
  return (
    <div className="grid max-w-2xl grid-cols-2 gap-4">
      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">기사 원문 요약</p>
        <p className="text-sm text-gray-600">{event.news.body}</p>

        <p className="mb-1 mt-3 text-xs font-medium text-gray-500">근거 문장</p>
        <p className="rounded-md bg-yellow-100/70 px-3 py-2 text-sm text-gray-800">
          &ldquo;{event.news.evidenceSentence}&rdquo;
        </p>
      </div>

      <dl className="grid h-fit grid-cols-2 gap-y-1.5 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
        {ANALYSIS_ROWS.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right font-medium text-gray-800">
              {key === "estimatedDurationHours"
                ? `${event.analysis.estimatedDurationHours}시간`
                : String(event.analysis[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
