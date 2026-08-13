import { CheckCircle2, Circle, Ship } from "lucide-react";
import { formatHoursKo, formatKnots } from "../../lib/format";

interface ChecklistItem {
  label: string;
  done: boolean;
}

export function ExecutionStatusCard({
  vesselName = "GLOVIS-E",
  approvedSpeedKnots,
  baseSpeedKnots,
  currentSpeedKnots,
  newEtaLabel,
  berthEtaLabel,
  decisionCausedDelayHours,
  captainAcknowledged,
  speedChangeStarted,
  targetReached,
}: {
  vesselName?: string;
  approvedSpeedKnots: number;
  baseSpeedKnots: number;
  currentSpeedKnots: number;
  newEtaLabel: string;
  berthEtaLabel: string;
  decisionCausedDelayHours: number;
  captainAcknowledged: boolean;
  speedChangeStarted: boolean;
  targetReached: boolean;
}) {
  const executionStatusLabel = targetReached
    ? "목표 속도 도달 · 모니터링 중"
    : speedChangeStarted
      ? "속도 변경 진행 중"
      : captainAcknowledged
        ? "선장 수신 확인 완료"
        : "선장 지시서 생성 완료";

  const checklist: ChecklistItem[] = [
    { label: "운항 변경 승인", done: true },
    { label: "선장 지시서 생성", done: true },
    { label: "대리점·화주 통보문 생성", done: true },
    { label: "선장 수신 확인", done: captainAcknowledged },
    { label: "속도 변경 개시", done: speedChangeStarted },
    { label: `목표 속도 ${formatKnots(approvedSpeedKnots)} 도달`, done: targetReached },
  ];

  return (
    <div className="flex flex-1 flex-col justify-between rounded-lg border-2 border-blue-500 bg-blue-50/40 px-5 py-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Ship size={22} className="text-blue-600" />
          <h2 className="text-xl font-extrabold text-blue-900">{vesselName} 감속안 실행 중</h2>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">승인 속도</dt>
            <dd className="font-bold text-blue-700">{formatKnots(approvedSpeedKnots)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">현재 속도</dt>
            <dd className="font-medium text-gray-800">
              {formatKnots(currentSpeedKnots)}
              {currentSpeedKnots !== baseSpeedKnots && currentSpeedKnots !== approvedSpeedKnots ? " (변경 중)" : ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">실행 상태</dt>
            <dd className="font-medium text-gray-800">{executionStatusLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">새 ETA</dt>
            <dd className="font-medium text-gray-800">{newEtaLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">예상 접안</dt>
            <dd className="font-medium text-gray-800">{berthEtaLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">접안 이후 지연</dt>
            <dd className="font-bold text-emerald-700">{formatHoursKo(decisionCausedDelayHours)}</dd>
          </div>
        </dl>
      </div>

      <ol className="mt-3 space-y-1 text-xs">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.done ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : (
              <Circle size={14} className="text-gray-300" />
            )}
            <span className={item.done ? "text-gray-700" : "text-gray-400"}>{item.label}</span>
            <span className={`ml-auto font-medium ${item.done ? "text-emerald-600" : "text-gray-400"}`}>
              {item.done ? "완료" : "대기"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
