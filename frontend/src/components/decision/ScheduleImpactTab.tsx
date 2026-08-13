import { DelayImpactComparison } from "./DelayImpactComparison";
import { ScheduleDomino } from "./ScheduleDomino";
import { TimeUsageBar } from "../execution/TimeUsageBar";
import type { ScheduleDominoStep } from "../../types/decision";

export function ScheduleImpactTab({
  eventDelayHours,
  arrivalDelayHours,
  anchorageWaitingHours,
  decisionCausedDelayHours,
  steps,
}: {
  eventDelayHours: number;
  arrivalDelayHours: number;
  anchorageWaitingHours: number;
  decisionCausedDelayHours: number;
  steps: ScheduleDominoStep[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <DelayImpactComparison eventDelayHours={eventDelayHours} decisionCausedDelayHours={decisionCausedDelayHours} />
        <ScheduleDomino steps={steps} />
      </div>
      <TimeUsageBar
        portDelayHours={eventDelayHours}
        arrivalDelayHours={arrivalDelayHours}
        anchorageWaitingHours={anchorageWaitingHours}
        decisionCausedDelayHours={decisionCausedDelayHours}
      />
    </div>
  );
}
