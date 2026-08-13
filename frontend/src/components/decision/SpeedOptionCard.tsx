import { AlertTriangle } from "lucide-react";
import { Badge } from "../common/Badge";
import type { SpeedOptionResult } from "../../types/decision";
import { formatHoursKo, formatIsoLabel, formatKnots, formatOptionId, formatUsdPlain } from "../../lib/format";

interface SpeedOptionCardProps {
  option: SpeedOptionResult;
  selected: boolean;
  isRecommended: boolean;
  readOnly?: boolean;
  onSelect: (optionId: SpeedOptionResult["optionId"]) => void;
}

export function SpeedOptionCard({ option, selected, isRecommended, readOnly = false, onSelect }: SpeedOptionCardProps) {
  const isDanger = option.recommendationLevel === "DANGER";
  const isCaution = option.recommendationLevel === "CAUTION";
  const dimmed = readOnly && !selected;

  const badge = isDanger
    ? selected
      ? { tone: "red" as const, label: "미권고선택됨" }
      : { tone: "red" as const, label: "미권고" }
    : isCaution
      ? { tone: "gray" as const, label: "조건부" }
      : isRecommended && selected
        ? { tone: "blue" as const, label: "권고선택됨" }
        : isRecommended
          ? { tone: "blue" as const, label: "권고" }
          : selected
            ? { tone: "gray" as const, label: "미권고선택됨" }
            : null;

  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => onSelect(option.optionId)}
      className={`flex flex-col rounded-lg border-2 bg-white p-3 text-left transition-all duration-200 max-[1439px]:min-[1100px]:p-2 ${
        selected
          ? isDanger
            ? "border-red-400 ring-2 ring-red-100 bg-red-50/30"
            : "border-blue-500 ring-2 ring-blue-100 bg-blue-50/30"
          : isRecommended
            ? "border-blue-300"
            : "border-gray-200 hover:border-gray-300"
      } ${dimmed ? "opacity-40" : ""} ${readOnly ? "cursor-default" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-gray-700">
          {formatOptionId(option.optionId)} {option.label}
        </span>
        {badge && (
          <Badge tone={badge.tone}>
            <span className="whitespace-nowrap">{badge.label}</span>
          </Badge>
        )}
      </div>

      <div className="mb-2 text-xl font-extrabold text-gray-900 transition-all duration-200 max-[1439px]:min-[1100px]:text-lg">
        {formatKnots(option.speedKnots)}
      </div>

      <dl className="space-y-1 text-xs text-gray-600">
        {option.arrivalDelayHours > 0 ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-gray-600">항구 도착 조정</dt>
            <dd className="font-medium text-gray-800">
              <span className="line-through text-gray-400 mr-1">{formatIsoLabel(option.baselineArrivalAtIso)}</span>
              <span>{formatIsoLabel(option.arrivalAtIso)}</span>
              <span className="ml-1 text-orange-500">(+{formatHoursKo(option.arrivalDelayHours)})</span>
            </dd>
          </div>
        ) : (
          <div className="flex justify-between">
            <dt>항구 도착 조정</dt>
            <dd className="font-medium text-gray-800">변동 없음</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>항구 앞 대기</dt>
          <dd className="font-medium text-gray-800 transition-all duration-200">{formatHoursKo(option.anchorageWaitingHours, 1)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>접안 이후 추가 지연</dt>
          <dd className={`font-medium transition-all duration-200 ${isDanger ? "text-red-600" : "text-gray-800"}`}>
            {isDanger ? `+${formatHoursKo(option.decisionCausedDelayHours)}` : "0h"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>연료비 절감</dt>
          <dd className={`font-semibold transition-all duration-200 ${option.fuelCostSavedUsd > 0 ? "text-emerald-600" : "text-gray-500"}`}>
            {option.optionId === "A" ? "-" : formatUsdPlain(option.fuelCostSavedUsd)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto pt-3">
        {isDanger ? (
          <div className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>터미널 협의 필요</span>
          </div>
        ) : option.recommendationLevel === "CAUTION" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-[11px] text-amber-700">
            운항 제약 검토 후 적용 (조건부)
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-[11px] text-emerald-700">
            접안 이후 일정 영향 없음
          </div>
        )}
      </div>
    </button>
  );
}
