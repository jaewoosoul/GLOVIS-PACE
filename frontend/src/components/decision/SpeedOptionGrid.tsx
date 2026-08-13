import { Card, CardBody, CardHeader } from "../common/Card";
import { Badge } from "../common/Badge";
import { SpeedOptionCard } from "./SpeedOptionCard";
import type { SpeedOptionId, SpeedOptionResult } from "../../types/decision";

export function SpeedOptionGrid({
  options,
  selectedOptionId,
  recommendedOptionId,
  readOnly = false,
  onSelect,
}: {
  options: SpeedOptionResult[];
  selectedOptionId: SpeedOptionId;
  recommendedOptionId: SpeedOptionId;
  readOnly?: boolean;
  onSelect: (optionId: SpeedOptionId) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between py-2">
        <span className="text-sm font-semibold text-gray-800">속도 옵션 비교</span>
        {readOnly && <Badge tone="blue">승인된 운항안</Badge>}
      </CardHeader>
      <CardBody className="py-3">
        <div className="grid grid-cols-4 gap-3 max-[1439px]:gap-2 max-[1100px]:grid-cols-2 max-[640px]:grid-cols-1">
          {options.map((option) => (
            <SpeedOptionCard
              key={option.optionId}
              option={option}
              selected={option.optionId === selectedOptionId}
              isRecommended={option.optionId === recommendedOptionId}
              readOnly={readOnly}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
