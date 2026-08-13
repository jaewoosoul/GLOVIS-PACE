import { AlertTriangle } from "lucide-react";
import type { SpeedOptionResult } from "../../types/decision";
import { formatOptionId } from "../../lib/format";

export function DelayChangeRiskWarning({
  option,
  portDelayAssumptionHours,
}: {
  option: SpeedOptionResult;
  portDelayAssumptionHours: number;
}) {
  if (option.decisionCausedDelayHours <= 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>
        현재 지연 가정 {portDelayAssumptionHours}시간 기준으로, 선택한 {formatOptionId(option.optionId)}안은 접안 이후 약{" "}
        <b>{option.decisionCausedDelayHours.toFixed(0)}시간</b>의 추가 지연을 만듭니다.
      </span>
    </div>
  );
}
