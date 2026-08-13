import { useMemo } from "react";
import {
  COMBINED_FLEET,
  OTHER_FLEET,
  MAP_ROUTES,
  OTHER_FLEET_ROUTES,
  OTHER_VESSEL_SCHEDULE,
  applyLiveVesselStatus,
  type MapRouteVesselId,
  type OtherVesselId,
} from "../data/fleetData";
import { SCENARIO_VESSELS, computeScenarioVesselProgressPercent, type ScenarioVesselId } from "../data/scenarioVessels";

const TOTAL_MANAGED_VESSELS = SCENARIO_VESSELS.length;
import { pointAlongPolylineWithSegment, computeOtherVesselProgressPercent } from "../lib/routeMap";
import type { FleetStatusSummary } from "./fleetCalculations";
import { useExecutionRecordsStore } from "../stores/executionRecordsStore";
import { useIncidentStore, type Incident } from "../stores/incidentStore";
import { useSimulationStore } from "../stores/simulationStore";
import { useScenarioVesselStore } from "../stores/scenarioVesselStore";
import type { FleetVessel, FleetAlertStatus, FleetOperationStatus } from "../types/fleet";

const OPERATION_STATUS_BY_SCENARIO_STATUS: Record<string, FleetOperationStatus> = {
  PLANNED: "SAILING",
  SAILING: "SAILING",
  WAITING: "ANCHORAGE",
  BERTHED: "PORT_OPERATION",
  CARGO_OPERATION: "PORT_OPERATION",
  COMPLETED: "PORT_OPERATION",
};

/** GLOVIS 5척 위치·속도·상태를 시뮬레이션 시계 기준으로 갱신. COMBINED_FLEET은 모듈 로드 시 고정값이므로 매 렌더마다 오버레이 필요. */
function applyLiveScenarioVesselData(
  fleet: FleetVessel[],
  currentSimTime: number,
  runtimeVessels: ReturnType<typeof useScenarioVesselStore.getState>["vessels"],
): FleetVessel[] {
  return fleet.map((v) => {
    const scenarioVessel = SCENARIO_VESSELS.find((sv) => sv.id === v.id.toUpperCase());
    const route = MAP_ROUTES[v.id as MapRouteVesselId];
    if (!scenarioVessel || !route) return v;

    const progressPercent = computeScenarioVesselProgressPercent(scenarioVessel, currentSimTime);
    const pos = pointAlongPolylineWithSegment(
      route.map((p) => ({ x: p.lon, y: p.lat })),
      progressPercent,
    );
    const runtime = runtimeVessels[scenarioVessel.id];
    return {
      ...v,
      longitude: pos.x,
      latitude: pos.y,
      heading: pos.angleDeg,
      speedKnots: runtime?.currentSpeedKn ?? v.speedKnots,
      operationStatus: runtime ? OPERATION_STATUS_BY_SCENARIO_STATUS[runtime.status] : v.operationStatus,
    };
  });
}

/** 타사 선박 위치를 시뮬레이션 시계로 갱신. 출발 전·도착 후는 null 반환돼 지도에서 제외. */
function applyDriftingBackgroundPositions(fleet: FleetVessel[], currentSimTime: number): FleetVessel[] {
  const result: FleetVessel[] = [];
  for (const v of fleet) {
    if (v.dataType !== "SIMULATED_FLEET") {
      result.push(v);
      continue;
    }
    const schedule = OTHER_VESSEL_SCHEDULE[v.id as OtherVesselId];
    const route = OTHER_FLEET_ROUTES[v.id as OtherVesselId];
    if (!schedule || !route) continue;

    const progressPercent = computeOtherVesselProgressPercent(schedule.departureMs, schedule.arrivalMs, currentSimTime);
    if (progressPercent === null) continue; // 출발 전 또는 도착 후 — 지도에서 숨김

    const pos = pointAlongPolylineWithSegment(route.map((p) => ({ x: p.lon, y: p.lat })), progressPercent);
    result.push({ ...v, longitude: pos.x, latitude: pos.y, heading: pos.angleDeg });
  }
  return result;
}

/** 사건 전체에서 아직 결정 안 난 선박 id 집합. selectedVesselId 1척만 보면 같은 사건의 다른 척이 누락된다. */
function computePendingDecisionVesselIds(incidents: Record<string, Incident>): Set<string> {
  const ids = new Set<string>();
  for (const incident of Object.values(incidents)) {
    if (incident.status === "COMPLETED") continue;
    if (!incident.rtaAnalysis) {
      for (const pv of incident.provisionalByVessel) {
        if (incident.decidedSpeedByVessel[pv.vesselId] === undefined) ids.add(pv.vesselId);
      }
    } else {
      for (const v of incident.confirmedDelayByVessel) {
        if (!v.revisionConfirmed) ids.add(v.vesselId);
      }
    }
  }
  return ids;
}

/** GLOVIS 5척 + alertStatus 오버레이를 합산해 현재 화면에 보여줄 자사 선대를 반환한다. */
export function useLiveCombinedFleet(): {
  fleet: FleetVessel[];
  otherFleet: FleetVessel[];
} {
  const incidents = useIncidentStore((s) => s.incidents);
  const executionRecords = useExecutionRecordsStore((s) => s.records);
  const currentSimTime = useSimulationStore((s) => s.currentSimTime);
  const runtimeVessels = useScenarioVesselStore((s) => s.vessels);

  const fleet = useMemo(() => {
    const overlay = new Map<string, FleetAlertStatus>();
    for (const record of Object.values(executionRecords)) {
      if (record.decisionStatus === "COMPLETED") continue;
      overlay.set(record.vesselId.toLowerCase(), "EXECUTING");
    }
    for (const vesselId of computePendingDecisionVesselIds(incidents)) {
      overlay.set(vesselId.toLowerCase(), "DECISION");
    }
    const live = applyLiveScenarioVesselData(COMBINED_FLEET, currentSimTime, runtimeVessels);
    const drifted = applyDriftingBackgroundPositions(live, currentSimTime);
    // PLANNED(미출항) · COMPLETED(운항 종료) 선박은 지도·대시보드에서 숨긴다.
    const active = drifted.filter((v) => {
      const sv = SCENARIO_VESSELS.find((s) => s.id === (v.id.toUpperCase() as ScenarioVesselId));
      if (!sv) return true;
      const status = runtimeVessels[sv.id]?.status;
      return status !== "PLANNED" && status !== "COMPLETED";
    });
    return applyLiveVesselStatus(active, overlay);
  }, [incidents, executionRecords, currentSimTime, runtimeVessels]);

  const otherFleet = useMemo(() => applyDriftingBackgroundPositions(OTHER_FLEET, currentSimTime), [currentSimTime]);

  return { fleet, otherFleet };
}

export function selectManagedVesselCount(_summary: FleetStatusSummary): number {
  return TOTAL_MANAGED_VESSELS;
}

export function selectUnderwayVesselCount(summary: FleetStatusSummary): number {
  return summary.sailing;
}

export function selectAnchoredVesselCount(summary: FleetStatusSummary): number {
  return summary.portOperation;
}

export function selectActiveExecutionCount(summary: FleetStatusSummary): number {
  return summary.executing;
}
