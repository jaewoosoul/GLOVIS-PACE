import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useLiveCombinedFleet } from "../calculations/fleetSelectors";
import { useAlertsStore, selectPendingAlerts } from "../stores/alertsStore";
import { FleetMap, type StatusFilter, type OwnershipFilterValue } from "../components/fleet/FleetMap";

type IndicatorFilter = { kind: "OWNERSHIP"; value: OwnershipFilterValue } | { kind: "STATUS"; value: StatusFilter };

export function FleetMapPage() {
  const [searchParams] = useSearchParams();
  const focusedVesselId = searchParams.get("vesselId");
  const { fleet, otherFleet } = useLiveCombinedFleet();
  const pendingAlerts = useAlertsStore(useShallow(selectPendingAlerts));

  const displayFleet = useMemo(() => [...fleet, ...otherFleet], [fleet, otherFleet]);
  const decisionCount = useMemo(() => fleet.filter((v) => v.alertStatus === "DECISION").length, [fleet]);
  const executingCount = useMemo(() => fleet.filter((v) => v.alertStatus === "EXECUTING").length, [fleet]);

  const [activeIndicator, setActiveIndicator] = useState<IndicatorFilter | null>(null);
  const [indicatorCommandToken, setIndicatorCommandToken] = useState(0);

  const isSame = (a: IndicatorFilter, b: IndicatorFilter) => a.kind === b.kind && a.value === b.value;

  const toggleIndicator = (filter: IndicatorFilter) => {
    setActiveIndicator((prev) => (prev && isSame(prev, filter) ? null : filter));
    setIndicatorCommandToken((t) => t + 1);
  };

  const externalCommand = activeIndicator
    ? activeIndicator.kind === "OWNERSHIP"
      ? { type: "OWNERSHIP" as const, value: activeIndicator.value }
      : { type: "STATUS" as const, value: activeIndicator.value }
    : { type: "STATUS" as const, value: "ALL" as StatusFilter };

  // 실제로 판단 대기 중인 사건만 지도에 항만 마커로 활성화한다 — Singapore/Shanghai를 항상 켜두지 않는다.
  const activeIncidentPortIds = useMemo(
    () => new Set(pendingAlerts.filter((a) => a.trigger !== "BERTH_SLOT_OPPORTUNITY").map((a) => a.port.toLowerCase())),
    [pendingAlerts],
  );
  const activeOpportunityPortIds = useMemo(
    () => new Set(pendingAlerts.filter((a) => a.trigger === "BERTH_SLOT_OPPORTUNITY").map((a) => a.port.toLowerCase())),
    [pendingAlerts],
  );

  const indicatorClass = (filter: IndicatorFilter, activeClasses: string) =>
    `pointer-events-auto rounded-md border px-3 py-1.5 text-xs font-semibold shadow ${
      activeIndicator && isSame(activeIndicator, filter) ? activeClasses : "border-gray-200 bg-white/95 text-gray-700"
    }`;

  const indicators = (
    <>
      <button
        type="button"
        onClick={() => toggleIndicator({ kind: "OWNERSHIP", value: "OWN" })}
        className={indicatorClass({ kind: "OWNERSHIP", value: "OWN" }, "border-black bg-black text-white")}
      >
        {fleet.length} 자사선
      </button>
      <button
        type="button"
        onClick={() => toggleIndicator({ kind: "OWNERSHIP", value: "OTHER" })}
        className={indicatorClass({ kind: "OWNERSHIP", value: "OTHER" }, "border-slate-400 bg-slate-500 text-white")}
      >
        {otherFleet.length} 타사선
      </button>
      <button
        type="button"
        onClick={() => toggleIndicator({ kind: "STATUS", value: "DECISION" })}
        className={indicatorClass({ kind: "STATUS", value: "DECISION" }, "border-amber-500 bg-amber-500 text-white")}
      >
        {decisionCount} 판단 대상 선박
      </button>
      <button
        type="button"
        onClick={() => toggleIndicator({ kind: "STATUS", value: "EXECUTING" })}
        className={indicatorClass({ kind: "STATUS", value: "EXECUTING" }, "border-blue-600 bg-blue-600 text-white")}
      >
        {executingCount} 실행 중 선박
      </button>
    </>
  );

  return (
    <FleetMap
      mode="FLEET_OVERVIEW"
      isApproved={false}
      vesselACurrentSpeedKnots={0}
      vesselATargetSpeedKnots={0}
      focusedVesselId={focusedVesselId}
      combinedFleet={displayFleet}
      activeIncidentPortIds={activeIncidentPortIds}
      activeOpportunityPortIds={activeOpportunityPortIds}
      mapOverlay={indicators}
      externalCommand={externalCommand}
      externalCommandToken={indicatorCommandToken}
    />
  );
}
