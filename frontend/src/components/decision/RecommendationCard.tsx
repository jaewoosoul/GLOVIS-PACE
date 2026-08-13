import { ArrowRight, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import type { SpeedOptionResult } from "../../types/decision";
import { formatHoursKo, formatKnots, formatOptionId, formatTons, formatUsdPlain } from "../../lib/format";

export function RecommendationCard({
  vesselName,
  recommendedOption,
  selectedOption,
  portDelayAssumptionHours,
  onOpenDetail,
  onApproveRecommended,
}: {
  vesselName: string;
  recommendedOption: SpeedOptionResult;
  selectedOption: SpeedOptionResult;
  portDelayAssumptionHours: number;
  onOpenDetail: () => void;
  onApproveRecommended: () => void;
}) {
  const differsFromRecommendation = selectedOption.optionId !== recommendedOption.optionId;
  const waitingGivenUp = selectedOption.anchorageWaitingHours - recommendedOption.anchorageWaitingHours;
  const savingGivenUp = recommendedOption.fuelCostSavedUsd - selectedOption.fuelCostSavedUsd;

  return (
    <div className="flex h-full flex-col rounded-lg border-2 border-blue-500 bg-blue-50/50 px-4 py-3">
      <div>
        <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-500">
          <ShieldCheck size={13} /> {vesselName} · {differsFromRecommendation ? "선택한 옵션" : "선택한 옵션 · 시스템 권고"}
        </p>
        <h2 className="text-lg font-extrabold text-blue-900">
          {formatOptionId(selectedOption.optionId)} {selectedOption.label} · {formatKnots(selectedOption.speedKnots)}
        </h2>
        <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">대기</dt>
            <dd className="font-medium text-gray-800">
              {formatHoursKo(portDelayAssumptionHours)} → {formatHoursKo(selectedOption.anchorageWaitingHours, 1)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">연료비 절감</dt>
            <dd className="font-bold text-emerald-600">{formatUsdPlain(selectedOption.fuelCostSavedUsd)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">CO₂ 절감</dt>
            <dd className="font-medium text-emerald-600">{formatTons(selectedOption.co2AvoidedTons)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">접안 이후 지연</dt>
            <dd className="font-bold text-emerald-700">{formatHoursKo(selectedOption.decisionCausedDelayHours)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-2 border-t border-blue-200 pt-2">
        {differsFromRecommendation ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            <p className="flex items-center gap-1 font-semibold">
              <AlertTriangle size={12} /> 시스템 권고({formatOptionId(recommendedOption.optionId)} {recommendedOption.label} ·{" "}
              {formatKnots(recommendedOption.speedKnots)}) 대비
            </p>
            <div className="mt-0.5 flex gap-4">
              <span>
                대기 {waitingGivenUp >= 0 ? "+" : ""}
                {waitingGivenUp.toFixed(1)}h
              </span>
              <span>절감 기회 -{formatUsdPlain(Math.max(0, savingGivenUp))}</span>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 size={13} /> 시스템 권고안과 동일합니다.
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          상세 계산
          <ArrowRight size={13} />
        </button>
        <button
          type="button"
          onClick={onApproveRecommended}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          권고안으로 선택
        </button>
      </div>
    </div>
  );
}
