import type { FleetVessel } from "../types/fleet";

export interface FleetStatusSummary {
  total: number;
  sailing: number;
  portOperation: number;
  monitoring: number;
  decision: number;
  executing: number;
}

/** 전체 선대(GLOVIS-A/B/C/D/E 5척)의 상태 버킷을 실제로 집계한다 — 화면에 하드코딩하지 않는다. */
export function computeFleetStatusSummary(vessels: FleetVessel[]): FleetStatusSummary {
  let sailing = 0;
  let portOperation = 0;
  let monitoring = 0;
  let decision = 0;
  let executing = 0;

  vessels.forEach((v) => {
    if (v.alertStatus === "EXECUTING") executing += 1;
    else if (v.alertStatus === "DECISION") decision += 1;
    else if (v.alertStatus === "MONITORING") monitoring += 1;
    else if (v.operationStatus === "PORT_OPERATION" || v.operationStatus === "ANCHORAGE") portOperation += 1;
    else sailing += 1;
  });

  return { total: vessels.length, sailing, portOperation, monitoring, decision, executing };
}
