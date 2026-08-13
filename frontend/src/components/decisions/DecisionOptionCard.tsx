import { AlertTriangle } from "lucide-react";
import { Badge } from "../common/Badge";
import type { DecisionOption } from "../../types/scenarioDecision";
import { NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS } from "../../calculations/scenarioDecisionCalculations";

function formatIso(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

interface DecisionOptionCardProps {
  option: DecisionOption;
  selected: boolean;
  readOnly?: boolean;
  onSelect: (speedKn: number) => void;
}

/** v7의 4옵션(현재유지/소폭감속/표준감속/최대감속) 판단 카드 — components/decision/SpeedOptionCard와 스타일을 맞췄다. */
export function DecisionOptionCard({ option, selected, readOnly = false, onSelect }: DecisionOptionCardProps) {
  const isDanger = option.downstreamDelayHours > NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS;
  const dimmed = readOnly && !selected;

  const badge = isDanger
    ? selected
      ? { tone: "red" as const, label: "미권고선택됨" }
      : { tone: "red" as const, label: "미권고" }
    : option.isRecommended && selected
      ? { tone: "blue" as const, label: "권고선택됨" }
      : option.isRecommended
        ? { tone: "blue" as const, label: "권고" }
        : selected
          ? { tone: "gray" as const, label: "미권고선택됨" }
          : null;

  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => onSelect(option.speedKn)}
      className={`flex flex-col rounded-lg border-2 bg-white p-3 text-left transition-all duration-200 ${
        selected
          ? isDanger
            ? "border-red-400 ring-2 ring-red-100 bg-red-50/30"
            : "border-blue-500 ring-2 ring-blue-100 bg-blue-50/30"
          : option.isRecommended
            ? "border-blue-300"
            : "border-gray-200 hover:border-gray-300"
      } ${dimmed ? "opacity-40" : ""} ${readOnly ? "cursor-default" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-gray-700">{option.label}</span>
        {badge && (
          <Badge tone={badge.tone}>
            <span className="whitespace-nowrap">{badge.label}</span>
          </Badge>
        )}
      </div>

      <div className="mb-2 text-xl font-extrabold text-gray-900">{option.speedKn.toFixed(2)}kn</div>

      <dl className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <dt>도착</dt>
          <dd className="font-medium text-gray-800">{formatIso(option.candidateArrivalIso)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>대기</dt>
          <dd className="font-medium text-gray-800">{option.waitHours.toFixed(1)}h</dd>
        </div>
        <div className="flex justify-between">
          <dt>접안</dt>
          <dd className="font-medium text-gray-800">{formatIso(option.berthingAtIso)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>접안 지연</dt>
          <dd className={`font-medium ${isDanger ? "text-red-600" : "text-gray-800"}`}>{isDanger ? `+${option.downstreamDelayHours.toFixed(1)}h` : "0h"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>연료 절감</dt>
          <dd className={`font-semibold ${option.fuelSavedTon > 0 ? "text-emerald-600" : "text-gray-500"}`}>
            {option.kind === "MAINTAIN" ? "기준" : `${option.fuelSavedTon.toFixed(1)}t ($${Math.round(option.fuelSavedUsd).toLocaleString()})`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>CO₂ 절감</dt>
          <dd className="font-medium text-gray-800">{option.co2AvoidedTon.toFixed(1)}t</dd>
        </div>
      </dl>

      <div className="mt-2">
        {isDanger ? (
          <div className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-700">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>계약 시간 미준수</span>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-[11px] text-emerald-700">접안 이후 일정 영향 없음</div>
        )}
      </div>
    </button>
  );
}
