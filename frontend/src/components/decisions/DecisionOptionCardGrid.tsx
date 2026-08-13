import { DecisionOptionCard } from "./DecisionOptionCard";
import type { DecisionOption } from "../../types/scenarioDecision";

export function DecisionOptionCardGrid({
  options,
  selectedSpeedKn,
  onSelect,
  readOnly = false,
}: {
  options: DecisionOption[];
  selectedSpeedKn: number;
  onSelect?: (speedKn: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
      {options.map((option) => (
        <DecisionOptionCard
          key={option.kind}
          option={option}
          selected={Math.abs(option.speedKn - selectedSpeedKn) < 0.001}
          readOnly={readOnly}
          onSelect={(speedKn) => onSelect?.(speedKn)}
        />
      ))}
    </div>
  );
}
