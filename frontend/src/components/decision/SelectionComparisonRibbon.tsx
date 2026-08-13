import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { SpeedOptionResult } from "../../types/decision";
import { formatHoursKo, formatOptionId, formatTons, formatUsdPlain } from "../../lib/format";

export function SelectionComparisonRibbon({
  selectedOption,
  recommendedOption,
  baselineOption,
}: {
  selectedOption: SpeedOptionResult;
  recommendedOption: SpeedOptionResult;
  baselineOption: SpeedOptionResult;
}) {
  const matchesRecommendation = selectedOption.optionId === recommendedOption.optionId;

  if (matchesRecommendation) {
    const waitingDelta = `${formatHoursKo(baselineOption.anchorageWaitingHours)} → ${formatHoursKo(selectedOption.anchorageWaitingHours, 1)}`;
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
        <p className="mb-1 text-sm font-bold text-blue-900">
          현재 선택: {formatOptionId(selectedOption.optionId)} {selectedOption.label}
        </p>
        <p className="mb-1.5 text-xs text-gray-500">현행 유지(a) 대비</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>
            대기시간 <b className="text-gray-800">{waitingDelta}</b>
          </span>
          <span>
            연료비 <b className="text-emerald-600">{selectedOption.optionId === "A" ? "기준" : `-${formatUsdPlain(selectedOption.fuelCostSavedUsd)}`}</b>
          </span>
          <span>
            CO₂ <b className="text-emerald-600">{selectedOption.co2AvoidedTons > 0 ? `-${formatTons(selectedOption.co2AvoidedTons)}` : "-"}</b>
          </span>
          <span className="flex items-center gap-1">
            접안 이후 일정
            {selectedOption.decisionCausedDelayHours > 0 ? (
              <b className="flex items-center gap-1 text-red-600">
                <AlertTriangle size={13} /> 약 {selectedOption.decisionCausedDelayHours.toFixed(0)}h 지연
              </b>
            ) : (
              <b className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> 영향 없음
              </b>
            )}
          </span>
        </div>
      </div>
    );
  }

  const waitingDeltaHours = selectedOption.anchorageWaitingHours - recommendedOption.anchorageWaitingHours;
  const fuelSavingsDeltaUsd = selectedOption.fuelCostSavedUsd - recommendedOption.fuelCostSavedUsd;
  const delayDeltaHours = selectedOption.decisionCausedDelayHours - recommendedOption.decisionCausedDelayHours;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
        <p className="text-sm font-bold text-amber-900">
          현재 선택: {formatOptionId(selectedOption.optionId)} {selectedOption.label}
        </p>
        <p className="text-xs text-amber-700">
          시스템 권고: {formatOptionId(recommendedOption.optionId)} {recommendedOption.label}
        </p>
      </div>
      <p className="mb-1.5 text-xs text-amber-700">권고안({formatOptionId(recommendedOption.optionId)}) 대비 이 옵션의 차이</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-amber-900">
        <span>
          항구 대기 차이{" "}
          <b>
            {waitingDeltaHours >= 0 ? "+" : ""}
            {waitingDeltaHours.toFixed(1)}h
          </b>
        </span>
        <span>
          연료비 절감액 차이{" "}
          <b className={fuelSavingsDeltaUsd >= 0 ? "text-emerald-700" : "text-red-600"}>
            {fuelSavingsDeltaUsd >= 0 ? "+" : "-"}
            {formatUsdPlain(fuelSavingsDeltaUsd)}
          </b>
        </span>
        <span>
          접안 이후 지연 차이{" "}
          <b className={delayDeltaHours > 0 ? "text-red-600" : "text-amber-900"}>
            {delayDeltaHours === 0 ? "동일" : `${delayDeltaHours >= 0 ? "+" : ""}${delayDeltaHours.toFixed(1)}h`}
          </b>
        </span>
      </div>
    </div>
  );
}
