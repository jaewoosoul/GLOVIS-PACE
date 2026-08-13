import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { SpeedOptionResult } from "../../types/decision";
import { formatHoursKo, formatKnots, formatOptionId, formatUsdPlain } from "../../lib/format";

export function FinalReviewModal({
  vesselName = "GLOVIS-E",
  option,
  recommendedOption,
  baseSpeedKnots,
  portDelayAssumptionHours,
  onCancel,
  onConfirm,
}: {
  vesselName?: string;
  option: SpeedOptionResult;
  recommendedOption: SpeedOptionResult;
  baseSpeedKnots: number;
  portDelayAssumptionHours: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const differsFromRecommendation = option.optionId !== recommendedOption.optionId;
  const [checkedSchedule, setCheckedSchedule] = useState(false);
  const [checkedSpeed, setCheckedSpeed] = useState(false);
  const canConfirm = checkedSchedule && checkedSpeed;

  const handleToggleAll = (checked: boolean) => {
    setCheckedSchedule(checked);
    setCheckedSpeed(checked);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-gray-900">운항 변경안을 승인하시겠습니까?</h3>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">대상 선박</dt>
            <dd className="font-medium text-gray-900">{vesselName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">현재 속도</dt>
            <dd className="font-medium text-gray-900">{formatKnots(baseSpeedKnots)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">목표 속도</dt>
            <dd className="font-medium text-gray-900">{formatKnots(option.speedKnots)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">예상 절감</dt>
            <dd className="font-medium text-emerald-600">
              {option.optionId === "A" ? "없음" : formatUsdPlain(option.fuelCostSavedUsd)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">항구 앞 대기</dt>
            <dd className="font-medium text-gray-900">
              {formatHoursKo(portDelayAssumptionHours)} → {formatHoursKo(option.anchorageWaitingHours, 1)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">접안 이후 지연</dt>
            <dd className={`font-medium ${option.decisionCausedDelayHours > 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatHoursKo(option.decisionCausedDelayHours)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">접안 시각</dt>
            <dd className="font-medium text-gray-900">
              {option.decisionCausedDelayHours > 0 ? "지연" : "변동 없음"}
            </dd>
          </div>
        </dl>

        {differsFromRecommendation && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              현재 선택은 시스템 권고안({formatOptionId(recommendedOption.optionId)} {recommendedOption.label})과 다릅니다. 권고안 대비
              대기시간과 비용 차이를 확인해 주세요.
            </span>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">
            <input type="checkbox" checked={canConfirm} onChange={(e) => handleToggleAll(e.target.checked)} />
            모두 동의
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={checkedSchedule} onChange={(e) => setCheckedSchedule(e.target.checked)} />
            일정 영향을 확인했습니다.
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={checkedSpeed} onChange={(e) => setCheckedSpeed(e.target.checked)} />
            선택한 속도와 계산 조건을 확인했습니다.
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            승인 확정
          </button>
        </div>
      </div>
    </div>
  );
}
