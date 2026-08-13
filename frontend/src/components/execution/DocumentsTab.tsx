import type { DocumentStatus, GeneratedDocument } from "../../types/decision";

const STATUS_CLASS: Record<DocumentStatus, string> = {
  "생성 완료": "bg-blue-50 text-blue-700 border-blue-200",
  "검토 대기": "bg-amber-50 text-amber-700 border-amber-200",
  "발송 완료": "bg-emerald-50 text-emerald-700 border-emerald-200",
  불필요: "bg-gray-100 text-gray-400 border-gray-200",
};

export function DocumentsTab({
  captainAcknowledged,
  speedChangeStarted,
  decisionCausedDelayHours,
}: {
  captainAcknowledged: boolean;
  speedChangeStarted: boolean;
  decisionCausedDelayHours: number;
}) {
  const documents: GeneratedDocument[] = [
    {
      type: "CAPTAIN_INSTRUCTION",
      label: "선장 속도 변경 지시서",
      status: captainAcknowledged ? "발송 완료" : "생성 완료",
    },
    {
      type: "AGENCY_ETA_NOTICE",
      label: "현지 대리점 ETA 변경 통보",
      status: speedChangeStarted ? "발송 완료" : "생성 완료",
    },
    { type: "SHIPPER_NOTICE", label: "화주 납기 영향 안내", status: "생성 완료" },
    {
      type: "SHIPPING_TEAM_REQUEST",
      label: "내부 선적팀 협의 요청",
      status: decisionCausedDelayHours > 0 ? "검토 대기" : "불필요",
    },
  ];

  return (
    <div className="grid max-w-2xl grid-cols-2 gap-3">
      {documents.map((doc) => (
        <div key={doc.type} className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-sm font-medium text-gray-800">{doc.label}</p>
          <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[doc.status]}`}>
            {doc.status}
          </span>
        </div>
      ))}
    </div>
  );
}
