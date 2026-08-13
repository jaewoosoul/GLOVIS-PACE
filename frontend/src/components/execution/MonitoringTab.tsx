import { formatKnots } from "../../lib/format";

export function MonitoringTab({
  currentSpeedKnots,
  targetSpeedKnots,
  eventStatusLabel = "파업 진행 중",
  eventStatusLabelKey = "현재 항만 사건",
  resumeConditionLabel = "파업 조기 타결 또는 운영 정상화",
}: {
  currentSpeedKnots: number;
  targetSpeedKnots: number;
  eventStatusLabel?: string;
  eventStatusLabelKey?: string;
  resumeConditionLabel?: string;
}) {
  return (
    <dl className="max-w-sm space-y-1.5 rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-gray-500">{eventStatusLabelKey}</dt>
        <dd className="font-medium text-red-600">{eventStatusLabel}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-500">현재 속도</dt>
        <dd className="font-medium text-gray-800">{formatKnots(currentSpeedKnots)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-500">목표 속도</dt>
        <dd className="font-medium text-gray-800">{formatKnots(targetSpeedKnots)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-500">마지막 상태 갱신</dt>
        <dd className="font-medium text-gray-800">방금 전</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-gray-500">정상 속도 복귀 조건</dt>
        <dd className="text-right font-medium text-gray-800">{resumeConditionLabel}</dd>
      </div>
    </dl>
  );
}
