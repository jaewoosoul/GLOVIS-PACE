import type { SpeedOptionResult } from "../../types/decision";
import { formatKnots, formatOptionId } from "../../lib/format";

export function ApprovalBar({
  option,
  isHeld,
  onReset,
  onHold,
  onApprove,
}: {
  baseSpeedKnots: number;
  option: SpeedOptionResult;
  isHeld: boolean;
  onReset: () => void;
  onHold: () => void;
  onApprove: () => void;
}) {
  const berthChanged = option.decisionCausedDelayHours > 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-8 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={onReset} className="text-xs font-medium text-gray-400 underline hover:text-gray-600">
            초기화
          </button>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-900">
            {formatOptionId(option.optionId)} {option.label} 선택
          </span>
          <span className="text-gray-500">· {formatKnots(option.speedKnots)}</span>
          <span className={`font-medium ${berthChanged ? "text-red-600" : "text-gray-500"}`}>
            · {berthChanged ? `접안 이후 약 ${option.decisionCausedDelayHours.toFixed(0)}시간 추가 지연` : "후속 일정 영향 없음"}
          </span>
          {isHeld && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">보류됨</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onHold}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            판단 보류
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="rounded-md bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            승인
          </button>
        </div>
      </div>
    </div>
  );
}
