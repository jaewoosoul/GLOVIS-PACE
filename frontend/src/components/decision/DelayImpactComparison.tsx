import { AlertTriangle } from "lucide-react";

export function DelayImpactComparison({
  eventDelayHours,
  decisionCausedDelayHours,
}: {
  eventDelayHours: number;
  decisionCausedDelayHours: number;
}) {
  const hasChoiceDelay = decisionCausedDelayHours > 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-xs text-gray-500">파업이 만든 지연</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-800">+{eventDelayHours}시간</p>
        </div>
        <div
          className={`rounded-lg border p-3 text-center ${
            hasChoiceDelay ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className={`text-xs ${hasChoiceDelay ? "text-red-600" : "text-emerald-600"}`}>
            현재 선택이 추가로 만든 일정 지연
          </p>
          <p
            className={`mt-1 flex items-center justify-center gap-2 text-2xl font-extrabold ${
              hasChoiceDelay ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {hasChoiceDelay && <AlertTriangle size={20} />}
            약 {decisionCausedDelayHours.toFixed(0)}시간
          </p>
          {hasChoiceDelay && <p className="mt-1 text-xs font-semibold text-red-600">터미널 협의 필요</p>}
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        {hasChoiceDelay
          ? "감속이 항만 지연시간보다 커서, 그 초과분은 선박 스스로 만든 추가 지연입니다."
          : "항구 도착은 늦어지지만, 기존 항구 대기시간 안에서 흡수되므로 접안 이후 일정은 밀리지 않습니다."}
      </p>
    </div>
  );
}
