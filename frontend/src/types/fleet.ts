export type FleetRegion =
  | "EAST_ASIA"
  | "SOUTHEAST_ASIA_INDIAN"
  | "MIDDLE_EAST_RED_SEA"
  | "EUROPE_MEDITERRANEAN"
  | "NORTH_AMERICA"
  | "LATIN_AMERICA"
  | "AFRICA"
  | "OCEANIA";

export type FleetOperationStatus = "SAILING" | "PORT_OPERATION" | "ANCHORAGE";
export type FleetAlertStatus = "NORMAL" | "MONITORING" | "DECISION" | "EXECUTING";
export type FleetDataType = "DEMO_DETAIL" | "SIMULATED_FLEET";
/** OWN = 현대글로비스 자사 선대(GLOVIS-A/B/C/D/E), OTHER = 참고용 타사 시뮬레이션 선박. */
export type FleetOwnership = "OWN" | "OTHER";

export interface FleetVessel {
  id: string;
  displayName?: string;
  longitude: number;
  latitude: number;
  heading: number;
  speedKnots: number;
  routeId: string;
  region: FleetRegion;
  operationStatus: FleetOperationStatus;
  alertStatus: FleetAlertStatus;
  dataType: FleetDataType;
  ownership: FleetOwnership;
}

export interface Vessel {
  id: string;
  name: string;
  vesselType: string;
  route: string[];
  currentSpeedKnots: number;
  destinationPort: string;
  scheduleBufferHours: number;
  /** 지도 위 상대 위치 표시용 (0~100, 출발항=0, 도착항=100 기준 진행률) */
  routeProgressPercent: number;
}
