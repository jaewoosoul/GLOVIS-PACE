import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { geoNaturalEarth1, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { feature as topojsonFeature } from "topojson-client";
import { Home, Search } from "lucide-react";
import worldLandRaw from "../../data/map/world-land-lowres.json";
import {
  MAP_PORTS,
  MAP_ROUTES,
  MAP_VESSEL_COLOR,
  OTHER_FLEET_ROUTES,
  OTHER_VESSEL_SCHEDULE,
  PORT_INFO_KO,
  VESSELS,
  WAITING_SHIPS_NEAR_SINGAPORE,
  type MapRouteVesselId,
  type OtherVesselId,
} from "../../data/fleetData";
import { pointAlongPolylineWithSegment, computeOtherVesselProgressPercent } from "../../lib/routeMap";
import { SCENARIO_VESSELS, computeScenarioVesselProgressPercent } from "../../data/scenarioVessels";
import { remainingDistanceAt, candidateArrivalAt } from "../../calculations/scenarioCalculations";
import { useSimulationStore } from "../../stores/simulationStore";
import { useScenarioVesselStore, type ScenarioVesselStatus } from "../../stores/scenarioVesselStore";
import { useIncidentStore, type Incident } from "../../stores/incidentStore";
import { EVENT_TYPE_MAP, EVENT_STATUS_MAP } from "../../calculations/incidentOptionAdapter";
import { MapLegend } from "./MapLegend";
import type { MapMode } from "../../stores/workflowStore";
import type { FleetRegion, FleetVessel } from "../../types/fleet";
import { REGION_LABELS, TRADE_CORRIDORS } from "../../data/regionCorridors";
import { formatIsoLabel } from "../../lib/format";

const LOG_PREFIX = "[FleetMap]";
// 컨테이너가 잠시 0×0으로 측정될 때만 쓰는 안전 최소값 — 실제 레이아웃 크기를 강제하지 않는다.
const SAFE_MIN_WIDTH = 320;
const SAFE_MIN_HEIGHT = 260;
const REPRESENTATIVE_CORRIDOR_ID = "far-east-europe";
const MAX_ZOOM_SCALE = 6;
/** 핵심 시나리오 5척(GLOVIS-A~E) 전용 마커 색 — 자사(검정)·타사(회색)·판단상태(주황/파랑)와 겹치지 않는 색으로 항상 구분해서 보여준다. */
const CORE_VESSEL_COLOR = "#7c3aed";
const CORE_VESSEL_IDS: MapRouteVesselId[] = ["glovis-a", "glovis-b", "glovis-c", "glovis-d", "glovis-e"];
/** scenarioVessels.ts의 UN/LOCODE를 MAP_PORTS id로 변환한다(판단 화면 자동 확대에 어느 항구가 관련됐는지 찾는 데 쓴다). */
const PORT_CODE_TO_MAP_ID: Record<string, string> = {
  CNSHA: "shanghai",
  SGSIN: "singapore",
  NLRTM: "rotterdam",
  HKHKG: "hongkong",
  KRPUS: "busan",
  GBSOU: "southampton",
};
/** 같은 막(사건)에서 함께 판단 대상이 되는 짝 선박 — 판단 화면에서 나란히 강조 표시한다(1막 GLOVIS-A는 단독). */
const COMPANION_VESSEL_ID: Partial<Record<MapRouteVesselId, MapRouteVesselId>> = {
  "glovis-b": "glovis-c",
  "glovis-c": "glovis-b",
  "glovis-d": "glovis-e",
  "glovis-e": "glovis-d",
};

function resolveScenarioRelevantPortIds(vesselId: string): string[] {
  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === vesselId.toUpperCase());
  if (!scenarioVessel) return ["shanghai", "singapore"];
  return [PORT_CODE_TO_MAP_ID[scenarioVessel.originPortCode], PORT_CODE_TO_MAP_ID[scenarioVessel.destinationPortCode]].filter(
    (id): id is string => !!id,
  );
}

/**
 * 선박의 지도상 현재 위치를 계산한다 — SCENARIO_VESSELS에 대응하는 항목이 있으면 시뮬레이션 가상
 * 시계(currentSimTime) 기준 실시간 진행률을, 없으면 VESSELS의 정적 routeProgressPercent를 쓴다.
 * corePositions뿐 아니라 판단 화면(DECISION_DRAFT/EXECUTING)의 강조 선박 위치도 반드시 이 함수를
 * 거쳐야 한다 — 정적 값을 쓰면 시간이 흘러도 배가 출항 시점에 멈춰 있는 것처럼 보인다.
 */
function resolveLiveVesselPos(vesselId: string, currentSimTime: number) {
  const route = MAP_ROUTES[vesselId as MapRouteVesselId];
  const detail = VESSELS.find((v) => v.id === vesselId);
  if (!route || !detail) return null;
  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === vesselId.toUpperCase());
  const progressPercent = scenarioVessel
    ? computeScenarioVesselProgressPercent(scenarioVessel, currentSimTime)
    : detail.routeProgressPercent;
  return pointAlongPolylineWithSegment(
    route.map((p) => ({ x: p.lon, y: p.lat })),
    progressPercent,
  );
}

const VESSEL_STATUS_LABEL: Record<ScenarioVesselStatus, string> = {
  PLANNED: "출항 대기",
  SAILING: "항해 중",
  WAITING: "접안 대기",
  BERTHED: "접안 중",
  CARGO_OPERATION: "하역 중",
  COMPLETED: "하역 완료",
};

type ScenarioRuntimeVessels = ReturnType<typeof useScenarioVesselStore.getState>["vessels"];

/** scenarioVesselStore의 실제 진행 상태를 한글 라벨로 변환한다 — 대응하는 시나리오 선박이 없으면 null. */
function resolveLiveStatusLabel(vesselId: string, runtimeVessels: ScenarioRuntimeVessels): string | null {
  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === vesselId.toUpperCase());
  if (!scenarioVessel) return null;
  const runtime = runtimeVessels[scenarioVessel.id];
  return runtime ? VESSEL_STATUS_LABEL[runtime.status] : null;
}

function formatDelayHours(hours: number): string {
  if (Math.abs(hours) < 0.5) return "정시";
  return `${hours > 0 ? "+" : ""}${hours.toFixed(0)}h`;
}

export interface LiveArrivalInfo {
  /** 사건 발생항(경유지)과 최종 도착항이 다른 항차인지 — 다르면 두 항 모두 보여준다(A/B/C). 같으면(D/E) 최종항만 보여준다. */
  hasInterimLeg: boolean;
  interimPortName: string;
  interimEtaLabel: string;
  interimDelayLabel: string;
  finalPortName: string;
  finalEtaLabel: string;
  finalDelayLabel: string;
}

/**
 * 경유지(사건 발생항)와 최종 도착항 각각의 "실질 도착 예정 시각 + 원계획 대비 지연"을 계산한다.
 * 경유지는 담당자가 실제로 확정한 속도(speedHistory)로 다시 계산하고, 최종항은 그 경유지 구간에서
 * 생긴 지연이 이후 항해에도 그대로 이어진다고 가정해 finalArrivalAtIso(원계획)에 같은 지연폭을 더한다
 * — 경유지 이후 구간의 속도 결정 데이터가 없어 "지연폭 유지"가 가장 단순하고 합리적인 근사다.
 */
function resolveLiveArrivalInfo(vesselId: string, currentSimTime: number, runtimeVessels: ScenarioRuntimeVessels): LiveArrivalInfo | null {
  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === vesselId.toUpperCase());
  if (!scenarioVessel) return null;
  const runtime = runtimeVessels[scenarioVessel.id];
  if (!runtime) return null;

  // 출발 전(미출항 상태)이면 출발 시각을 기준으로 계산한다 — currentSimTime 기준으로 하면 출발 전 잔여거리를 즉시
  // 항행하는 것으로 계산해 도착 예정이 출발 시각보다 한참 앞선 엉뚱한 값이 나온다.
  const departureMs = new Date(scenarioVessel.departureAtIso).getTime();
  const effectiveNowMs = Math.max(currentSimTime, departureMs);
  const nowIso = new Date(effectiveNowMs).toISOString();
  const remainingNm = remainingDistanceAt(scenarioVessel.legDistanceNm, scenarioVessel.departureAtIso, scenarioVessel.baseSpeedKn, runtime.speedHistory, nowIso);
  const interimEtaIso = candidateArrivalAt(nowIso, remainingNm, runtime.currentSpeedKn);
  const interimDelayHours = (new Date(interimEtaIso).getTime() - new Date(scenarioVessel.originalAssignedEtaIso).getTime()) / 3_600_000;

  const finalPortName = scenarioVessel.route[scenarioVessel.route.length - 1];
  const hasInterimLeg = finalPortName !== scenarioVessel.destinationPortName;
  const finalEtaIso = hasInterimLeg
    ? new Date(new Date(scenarioVessel.finalArrivalAtIso).getTime() + interimDelayHours * 3_600_000).toISOString()
    : interimEtaIso;

  return {
    hasInterimLeg,
    interimPortName: scenarioVessel.destinationPortName,
    interimEtaLabel: formatIsoLabel(interimEtaIso),
    interimDelayLabel: formatDelayHours(interimDelayHours),
    finalPortName,
    finalEtaLabel: formatIsoLabel(finalEtaIso),
    finalDelayLabel: formatDelayHours(interimDelayHours),
  };
}

interface ScenarioVesselDetailInfo {
  ageYears: number;
  baseSpeedKn: number;
  minSpeedKn: number;
  departureLabel: string;
  latestSpeedChangeLabel: string | null;
}

/** "선박 상세 보기"를 펼쳤을 때 보여줄 추가 정보 — GLOVIS(SCENARIO_VESSELS에 대응) 선박에만 존재한다. */
function resolveScenarioVesselDetailInfo(vesselId: string, runtimeVessels: ScenarioRuntimeVessels): ScenarioVesselDetailInfo | null {
  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === vesselId.toUpperCase());
  if (!scenarioVessel) return null;
  const runtime = runtimeVessels[scenarioVessel.id];
  const lastSegment = runtime?.speedHistory[runtime.speedHistory.length - 1] ?? null;

  return {
    ageYears: scenarioVessel.ageYears,
    baseSpeedKn: scenarioVessel.baseSpeedKn,
    minSpeedKn: scenarioVessel.minSpeedKn,
    departureLabel: formatIsoLabel(scenarioVessel.departureAtIso),
    latestSpeedChangeLabel: lastSegment ? `${formatIsoLabel(lastSegment.fromIso)}부터 ${lastSegment.speedKn.toFixed(1)}kn` : null,
  };
}

interface PortIncidentInfo {
  eventTypeLabel: string;
  eventStatusLabel: string;
  estimatedDurationHours: number | null;
}

/** 항구 이름으로 진행 중인(실제) 사건을 찾아 마커·팝업에 쓸 실제 사건 유형/상태/예상 지속시간을 뽑는다 — "파업" 고정 문구 대신 쓴다. */
function resolvePortIncidentInfo(portName: string, incidents: Record<string, Incident>): PortIncidentInfo | null {
  const incident = Object.values(incidents).find((i) => i.portName.toLowerCase() === portName.toLowerCase() && i.status !== "COMPLETED");
  if (!incident?.newsAnalysis) return null;
  const analysis = incident.newsAnalysis;
  return {
    eventTypeLabel: EVENT_TYPE_MAP[analysis.eventType],
    eventStatusLabel: EVENT_STATUS_MAP[analysis.eventStatus],
    estimatedDurationHours: analysis.timing.reportedDurationHours?.max ?? analysis.timing.reportedDurationHours?.min ?? incident.provisionalDelayHours,
  };
}

export type StatusFilter = "ALL" | FleetVessel["alertStatus"];
type RegionFilterValue = "ALL" | FleetRegion;
export type OwnershipFilterValue = "ALL" | FleetVessel["ownership"];

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "전체 상태" },
  { value: "NORMAL", label: "정상" },
  { value: "MONITORING", label: "모니터링" },
  { value: "DECISION", label: "판단 필요" },
  { value: "EXECUTING", label: "실행 중" },
];

const OWNERSHIP_FILTER_OPTIONS: Array<{ value: OwnershipFilterValue; label: string }> = [
  { value: "ALL", label: "전체 선박" },
  { value: "OWN", label: "자사선" },
  { value: "OTHER", label: "타사선" },
];

interface FleetMapProps {
  mode: MapMode;
  isApproved: boolean;
  /** DECISION_DRAFT/EXECUTING에서 지도상 강조 표시할 선박(기본 "glovis-e"). 실제 판단 대상 선박(GLOVIS-A~E 중 하나)의 id를 호출부가 넘긴다. */
  highlightedVesselId?: string;
  vesselACurrentSpeedKnots: number;
  vesselATargetSpeedKnots: number;
  focusedVesselId: string | null;
  decisionCausedDelayHours?: number;
  combinedFleet: FleetVessel[];
  /** 우측 선대 패널 등 지도 밖에서 상태/권역/소유권 필터를 지시할 때 사용 (token을 올려 같은 값 재요청도 반영). */
  externalCommand?:
    | { type: "STATUS"; value: StatusFilter }
    | { type: "REGION"; value: FleetRegion }
    | { type: "OWNERSHIP"; value: OwnershipFilterValue }
    | null;
  externalCommandToken?: number;
  /**
   * 실제로 판단 대기 중인 사건/기회 항만 id 집합. 전달되면 MAP_PORTS의 고정 hasIncident/hasOpportunity
   * 대신 이 값을 사용한다 — /map(FleetMapPage)처럼 항상 켜져 있으면 안 되는 화면에서 사용한다.
   * 전달하지 않으면(감속·증속 판단 상세 화면처럼 해당 사건이 실제로 열려 있는 경우) 기존 고정값을 그대로 쓴다.
   */
  activeIncidentPortIds?: Set<string>;
  activeOpportunityPortIds?: Set<string>;
  /** 지도 뷰포트 우측 상단에 겹치지 않게 배치할 오버레이(예: 척수 인디케이터). 필터 바 아래 지도 영역 기준으로 위치한다. */
  mapOverlay?: ReactNode;
}

/** worldLandRaw가 FeatureCollection이 아니라 Topology로 바뀌더라도 형식을 추측하지 않고 명시적으로 변환한다. */
function resolveLandFeatureCollection(raw: unknown): GeoJSON.FeatureCollection {
  const data = raw as { type?: string; objects?: Record<string, unknown> };
  if (data.type === "FeatureCollection") {
    return raw as GeoJSON.FeatureCollection;
  }
  if (data.type === "Topology" && data.objects) {
    const firstObjectKey = Object.keys(data.objects)[0];
    console.warn(`${LOG_PREFIX} world-land 데이터가 Topology 형식이라 topojson-client로 변환합니다 (object: ${firstObjectKey}).`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted: unknown = topojsonFeature(raw as any, (raw as any).objects[firstObjectKey]);
    const convertedTyped = converted as { type: string; features?: GeoJSON.Feature[] };
    return convertedTyped.type === "FeatureCollection"
      ? (converted as GeoJSON.FeatureCollection)
      : { type: "FeatureCollection", features: [converted as GeoJSON.Feature] };
  }
  console.error(`${LOG_PREFIX} world-land 데이터 형식을 인식할 수 없습니다:`, data.type);
  return { type: "FeatureCollection", features: [] };
}

const DETAIL_VESSEL_BY_ID = new Map(VESSELS.map((v) => [v.id, v]));

export function FleetMap({
  mode,
  isApproved,
  highlightedVesselId = "glovis-e",
  vesselACurrentSpeedKnots,
  vesselATargetSpeedKnots,
  focusedVesselId,
  decisionCausedDelayHours = 0,
  combinedFleet,
  externalCommand,
  externalCommandToken,
  activeIncidentPortIds,
  activeOpportunityPortIds,
  mapOverlay,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [landError, setLandError] = useState<string | null>(null);
  const [worldViewOverride, setWorldViewOverride] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [regionFilter, setRegionFilter] = useState<RegionFilterValue>("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilterValue>("ALL");
  const [activePopup, setActivePopup] = useState<{ kind: "vessel" | "port"; id: string } | null>(null);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [hoveredVesselId, setHoveredVesselId] = useState<string | null>(null);
  const [expandedDetailVesselId, setExpandedDetailVesselId] = useState<string | null>(null);

  const isDecisionMode = mode === "DECISION_DRAFT" || mode === "EXECUTING";
  const scopedToAsia = isDecisionMode && !worldViewOverride;
  const markerScale = 1 / transform.k;

  // 판단 화면(mode) 진입 시 세계 보기 오버라이드를 초기화한다.
  useEffect(() => {
    setWorldViewOverride(false);
    setActivePopup(null);
  }, [mode]);

  // 컨테이너(지도 뷰포트, 필터바 제외) 실측 크기 (0이면 안전 최소값으로만 보정)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.max(rect.width, SAFE_MIN_WIDTH), height: Math.max(rect.height, SAFE_MIN_HEIGHT) });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const landFeatureCollection = useMemo(() => {
    try {
      return resolveLandFeatureCollection(worldLandRaw);
    } catch (err) {
      console.error(`${LOG_PREFIX} world-land 데이터 파싱 실패:`, err);
      setLandError("세계지도 데이터를 렌더링하지 못했습니다.");
      return { type: "FeatureCollection" as const, features: [] };
    }
  }, []);

  const projection: GeoProjection | null = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null;
    try {
      return geoNaturalEarth1().fitExtent(
        [
          [20, 20],
          [size.width - 20, size.height - 20],
        ],
        landFeatureCollection.features.length > 0 ? landFeatureCollection : { type: "Sphere" as const },
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} projection 생성 실패:`, err);
      setLandError("세계지도 데이터를 렌더링하지 못했습니다.");
      return null;
    }
  }, [size, landFeatureCollection]);

  const pathGenerator: GeoPath | null = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  // d3-zoom 연결 (초기 렌더는 zoomIdentity, 이후 사용자 조작/버튼으로만 변경). 마커·라벨은 markerScale로 역보정한다.
  useEffect(() => {
    if (!svgRef.current || size.width === 0) return;
    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAX_ZOOM_SCALE])
      .on("zoom", (event) => setTransform(event.transform));
    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(svgRef.current);
    selection.call(zoomBehavior);
    selection.call(zoomBehavior.transform, zoomIdentity);
    return () => {
      selection.on(".zoom", null);
    };
  }, [size.width, size.height]);

  const flyToBounds = (points: Array<[number, number]>) => {
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior || !projection || points.length === 0) return;
    const projected = points.map((p) => projection(p)).filter((p): p is [number, number] => !!p);
    if (projected.length === 0) return;
    const xs = projected.map((p) => p[0]);
    const ys = projected.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padding = 70;
    const boxWidth = Math.max(maxX - minX, 1);
    const boxHeight = Math.max(maxY - minY, 1);
    const scale = Math.min(
      MAX_ZOOM_SCALE,
      Math.max(1, Math.min((size.width - padding * 2) / boxWidth, (size.height - padding * 2) / boxHeight)),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const nextTransform = zoomIdentity
      .translate(size.width / 2, size.height / 2)
      .scale(scale)
      .translate(-cx, -cy);
    select(svg).transition().duration(800).call(zoomBehavior.transform, nextTransform);
  };

  const resetToWorld = () => {
    setWorldViewOverride(true);
    setSearchText("");
    setStatusFilter("ALL");
    setRegionFilter("ALL");
    setOwnershipFilter("ALL");
    setActivePopup(null);
    setSelectedVesselId(null);
    setHoveredVesselId(null);
    const svg = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svg || !zoomBehavior) return;
    select(svg).transition().duration(800).call(zoomBehavior.transform, zoomIdentity);
  };

  const currentSimTime = useSimulationStore((s) => s.currentSimTime);
  const scenarioVesselRuntime = useScenarioVesselStore((s) => s.vessels);
  const incidents = useIncidentStore((s) => s.incidents);

  // currentSimTime이 점프할 때 displaySimTime을 rAF로 서서히 증가시켜 선박이 항로를 따라 이동하게 한다.
  const [displaySimTime, setDisplaySimTime] = useState(currentSimTime);
  const animFrameRef = useRef<number>(0);
  const animStartRef = useRef<{ fromMs: number; toMs: number; startWall: number } | null>(null);

  useEffect(() => {
    const from = animStartRef.current?.toMs ?? displaySimTime;
    const to = currentSimTime;
    if (from === to) return;

    // 시뮬레이션 시간 점프 크기에 비례해 애니메이션 시간을 늘린다 — 점프가 클수록 선박이 너무 빠르게
    // 이동하는 것을 방지한다. 최소 1200ms, 최대 4000ms로 고정한다.
    const deltaHours = (to - from) / 3_600_000;
    const ANIM_DURATION = Math.min(4000, Math.max(1200, deltaHours * 50));
    animStartRef.current = { fromMs: from, toMs: to, startWall: performance.now() };
    cancelAnimationFrame(animFrameRef.current);

    function tick(now: number) {
      const anim = animStartRef.current;
      if (!anim) return;
      const raw = (now - anim.startWall) / ANIM_DURATION;
      const t = Math.min(raw, 1);
      // ease-in-out
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setDisplaySimTime(Math.round(anim.fromMs + (anim.toMs - anim.fromMs) * eased));
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSimTime]);

  const highlightedVesselPos = useMemo(() => {
    return (
      resolveLiveVesselPos(highlightedVesselId, displaySimTime) ?? resolveLiveVesselPos("glovis-e", displaySimTime)!
    );
  }, [highlightedVesselId, displaySimTime]);

  /**
   * 핵심 5척의 실제 항로상 현재 위치 — 리전 클러스터에 묻히지 않고 항상 개별 마커로 보여주는 데 쓴다.
   * "다음 이벤트"를 눌러 시간이 흐를 때마다 5척이 항로를 따라 실제로 전진하는 것처럼 보이게 한다.
   */
  const corePositions = useMemo(() => {
    return CORE_VESSEL_IDS.map((id) => {
      const detail = VESSELS.find((v) => v.id === id);
      const pos = resolveLiveVesselPos(id, displaySimTime);
      if (!detail || !pos) return null;
      const runtime = scenarioVesselRuntime[id.toUpperCase() as keyof typeof scenarioVesselRuntime];
      // PLANNED(미출항) · COMPLETED(운항 종료) 선박은 지도에서 숨긴다.
      if (runtime?.status === "PLANNED" || runtime?.status === "COMPLETED") return null;
      const speedKnots = runtime?.currentSpeedKn ?? detail.currentSpeedKnots;
      return { id, name: detail.name, speedKnots, x: pos.x, y: pos.y };
    }).filter((v): v is { id: MapRouteVesselId; name: string; speedKnots: number; x: number; y: number } => v !== null);
  }, [displaySimTime, scenarioVesselRuntime]);

  const companionVesselId = COMPANION_VESSEL_ID[highlightedVesselId as MapRouteVesselId];

  const companionVesselPos = useMemo(() => {
    if (!companionVesselId) return null;
    return resolveLiveVesselPos(companionVesselId, displaySimTime);
  }, [companionVesselId, displaySimTime]);

  // OTHER 선박 위치를 displaySimTime 기준으로 재계산 — 출발 전·도착 후는 숨기고, 항해 중만 표시.
  const otherFleetDisplayPositions = useMemo(() => {
    const result: typeof combinedFleet = [];
    for (const vessel of combinedFleet) {
      if (vessel.ownership !== "OTHER") continue;
      const schedule = OTHER_VESSEL_SCHEDULE[vessel.id as OtherVesselId];
      const route = OTHER_FLEET_ROUTES[vessel.id as OtherVesselId];
      if (!schedule || !route) continue;
      const progressPercent = computeOtherVesselProgressPercent(schedule.departureMs, schedule.arrivalMs, displaySimTime);
      if (progressPercent === null) continue;
      const pos = pointAlongPolylineWithSegment(route.map((p) => ({ x: p.lon, y: p.lat })), progressPercent);
      result.push({ ...vessel, longitude: pos.x, latitude: pos.y, heading: pos.angleDeg });
    }
    return result;
  }, [displaySimTime, combinedFleet]);

  // 지도 밖(신호함, 우측 패널 등)에서 선박 포커스가 지정되면 해당 선박으로 이동한다.
  useEffect(() => {
    if (!focusedVesselId || !projection) return;
    setActivePopup({ kind: "vessel", id: focusedVesselId });
    setSelectedVesselId(focusedVesselId);
    const pos = resolveLiveVesselPos(focusedVesselId, currentSimTime);
    if (pos) {
      flyToBounds([[pos.x, pos.y]]);
      return;
    }
    const simulated = combinedFleet.find((v) => v.id === focusedVesselId);
    if (simulated) {
      flyToBounds([[simulated.longitude, simulated.latitude]]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedVesselId, projection]);

  // 판단 화면(DECISION_DRAFT/EXECUTING)에서는 강조 선박의 사건 관련 항구(출항/사건 발생항) + 강조 선박(+ 같은 막의 짝 선박) 구간으로 자동 확대한다(수동 조작 없음).
  useEffect(() => {
    if (!scopedToAsia || !projection) return;
    const relevantPortIds = resolveScenarioRelevantPortIds(highlightedVesselId);
    const relevantPorts = MAP_PORTS.filter((p) => relevantPortIds.includes(p.id)).map((p) => [p.lon, p.lat] as [number, number]);
    const boundsPoints: Array<[number, number]> = [...relevantPorts, [highlightedVesselPos.x, highlightedVesselPos.y]];
    if (companionVesselPos) boundsPoints.push([companionVesselPos.x, companionVesselPos.y]);
    flyToBounds(boundsPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedToAsia, projection, highlightedVesselId, companionVesselPos]);

  // 권역 필터 선택 시 해당 권역으로 확대한다.
  useEffect(() => {
    if (isDecisionMode || regionFilter === "ALL" || !projection) return;
    const region = regionFilter;
    const points = combinedFleet.filter((v) => v.region === region).map((v) => [v.longitude, v.latitude] as [number, number]);
    flyToBounds(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, projection]);

  // 우측 선대 패널 등 지도 밖에서의 상태/소유권/권역 필터 지시(externalCommand)를 반영한다.
  useEffect(() => {
    if (!externalCommand || isDecisionMode || !projection) return;
    if (externalCommand.type === "STATUS") {
      // STATUS/OWNERSHIP는 서로 배타적으로 적용한다 — 이 선박군만 보이고 나머지는 숨긴다.
      setStatusFilter(externalCommand.value);
      setOwnershipFilter("ALL");
    } else if (externalCommand.type === "OWNERSHIP") {
      setOwnershipFilter(externalCommand.value);
      setStatusFilter("ALL");
    } else if (externalCommand.type === "REGION") {
      const region = externalCommand.value;
      const points = combinedFleet.filter((v) => v.region === region).map((v) => [v.longitude, v.latitude] as [number, number]);
      flyToBounds(points);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCommandToken, projection]);

  const routeAHighlightPath = useMemo(() => {
    if (!isDecisionMode) return null;
    const route = MAP_ROUTES[highlightedVesselId as MapRouteVesselId] ?? MAP_ROUTES["glovis-e"];
    const incidentPortIds = resolveScenarioRelevantPortIds(highlightedVesselId);
    const incidentPort = MAP_PORTS.find((p) => p.id === incidentPortIds[1]);
    const incidentPortIndex = incidentPort
      ? route.findIndex((p) => p.lon === incidentPort.lon && p.lat === incidentPort.lat)
      : -1;
    const endIndex = incidentPortIndex >= 0 ? incidentPortIndex : route.length - 1;
    const remaining = route.slice(highlightedVesselPos.segmentIndex + 1, endIndex + 1);
    return {
      type: "LineString" as const,
      coordinates: [[highlightedVesselPos.x, highlightedVesselPos.y], ...remaining.map((p) => [p.lon, p.lat] as [number, number])],
    };
  }, [isDecisionMode, highlightedVesselId, highlightedVesselPos]);


  const matchesFilters = (vessel: FleetVessel): boolean => {
    if (statusFilter !== "ALL" && vessel.alertStatus !== statusFilter) return false;
    if (ownershipFilter !== "ALL" && vessel.ownership !== ownershipFilter) return false;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const name = (vessel.displayName ?? vessel.id).toLowerCase();
      if (!name.includes(q) && !vessel.id.toLowerCase().includes(q)) return false;
    }
    return true;
  };

  const anyFilterActive = statusFilter !== "ALL" || ownershipFilter !== "ALL" || searchText.trim().length > 0;

  /** FLEET_OVERVIEW에서 클릭으로 선택된 시뮬레이션 선박의 예정 항로(소속 권역 통로)를 근사 표시한다. */
  const selectedSimulatedRoute = useMemo(() => {
    if (mode !== "FLEET_OVERVIEW" || !selectedVesselId || MAP_ROUTES[selectedVesselId as MapRouteVesselId]) return null;
    const route = OTHER_FLEET_ROUTES[selectedVesselId as OtherVesselId];
    if (!route) return null;
    return { type: "LineString" as const, coordinates: route.map((p) => [p.lon, p.lat] as [number, number]) };
  }, [mode, selectedVesselId]);

  const resolvedPorts = useMemo(() => {
    if (!activeIncidentPortIds && !activeOpportunityPortIds) return MAP_PORTS;
    return MAP_PORTS.map((port) => ({
      ...port,
      hasIncident: activeIncidentPortIds ? activeIncidentPortIds.has(port.id) : port.hasIncident,
      hasOpportunity: activeOpportunityPortIds ? activeOpportunityPortIds.has(port.id) : port.hasOpportunity,
    }));
  }, [activeIncidentPortIds, activeOpportunityPortIds]);

  const visiblePorts = useMemo(() => {
    if (!scopedToAsia) return resolvedPorts;
    const relevantPortIds = resolveScenarioRelevantPortIds(highlightedVesselId);
    return resolvedPorts.filter((p) => relevantPortIds.includes(p.id));
  }, [resolvedPorts, scopedToAsia, highlightedVesselId]);

  const visibleDetailVessels = useMemo(() => {
    if (!scopedToAsia) return VESSELS;
    return VESSELS.filter((v) => v.id === highlightedVesselId || v.id === companionVesselId);
  }, [scopedToAsia, highlightedVesselId, companionVesselId]);

  if (landError) {
    console.error(`${LOG_PREFIX} ${landError}`);
  }

  const routeEmphasis = (vesselId: MapRouteVesselId): { width: number; opacity: number } => {
    if (vesselId === highlightedVesselId) {
      if (isDecisionMode) return { width: 4.5, opacity: 1 };
      return { width: 3, opacity: 0.85 };
    }
    if (vesselId === companionVesselId) {
      return { width: 2, opacity: 0.85 };
    }
    return { width: 2, opacity: isDecisionMode ? 0.25 : 0.5 };
  };

  const projectToScreen = (lon: number, lat: number): [number, number] | null => {
    const p = projection?.([lon, lat]);
    if (!p) return null;
    return [transform.applyX(p[0]), transform.applyY(p[1])];
  };

  const activeVessel = useMemo(() => {
    if (activePopup?.kind !== "vessel") return null;
    return combinedFleet.find((v) => v.id === activePopup.id) ?? null;
  }, [activePopup, combinedFleet]);
  const activeDetail = activeVessel ? DETAIL_VESSEL_BY_ID.get(activeVessel.id) : undefined;
  const activePort = activePopup?.kind === "port" ? resolvedPorts.find((p) => p.id === activePopup.id) ?? null : null;
  const activePortVesselNames = useMemo(() => {
    if (!activePort) return [];
    return VESSELS.filter((v) => v.route.includes(activePort.name)).map((v) => v.name);
  }, [activePort]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {!isDecisionMode && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-100 bg-white px-2 py-1.5">
          <div className="flex min-w-[140px] flex-1 items-center gap-1 rounded-md border border-gray-300 px-2 py-1">
            <Search size={12} className="text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="선박명 · IMO 검색"
              className="w-full text-xs outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value as RegionFilterValue)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            <option value="ALL">전체 권역</option>
            {(Object.keys(REGION_LABELS) as FleetRegion[]).map((region) => (
              <option key={region} value={region}>
                {REGION_LABELS[region]}
              </option>
            ))}
          </select>
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value as OwnershipFilterValue)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
          >
            {OWNERSHIP_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        {size.width > 0 && (
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${size.width} ${size.height}`}
            style={{ display: "block", cursor: "grab" }}
            onClick={() => setActivePopup(null)}
          >
            <rect x={0} y={0} width={size.width} height={size.height} className="fill-blue-50" />
            <g transform={transform.toString()}>
              <g className="land-layer">
                {landFeatureCollection.features.map((f, i) => {
                  if (!pathGenerator) return null;
                  let d: string | null = null;
                  try {
                    d = pathGenerator(f);
                  } catch (err) {
                    console.error(`${LOG_PREFIX} land feature ${i} 렌더링 실패:`, err);
                  }
                  return d ? (
                    <path key={i} d={d} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
                  ) : null;
                })}
              </g>

              <g className="trade-corridor-layer">
                {pathGenerator &&
                  !scopedToAsia &&
                  TRADE_CORRIDORS.filter((c) => c.id === REPRESENTATIVE_CORRIDOR_ID).map((c) => {
                    const d = pathGenerator({ type: "LineString", coordinates: c.points.map((p) => [p.lon, p.lat]) });
                    return d ? (
                      <path
                        key={c.id}
                        d={d}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.35}
                        vectorEffect="non-scaling-stroke"
                      >
                        <title>{c.name}</title>
                      </path>
                    ) : null;
                  })}
              </g>

              <g className="route-layer">
                {pathGenerator &&
                  (Object.keys(MAP_ROUTES) as MapRouteVesselId[])
                    .filter((vesselId) => {
                      // PLANNED · COMPLETED 선박은 항로선도 숨긴다.
                      const rt = scenarioVesselRuntime[vesselId.toUpperCase() as keyof typeof scenarioVesselRuntime];
                      if (rt?.status === "PLANNED" || rt?.status === "COMPLETED") return false;
                      // FLEET_OVERVIEW: 항로는 상시 숨김 — 사용자가 클릭해 선택한 선박의 항로만 보여준다.
                      if (mode === "FLEET_OVERVIEW") return vesselId === selectedVesselId;
                      return !scopedToAsia || vesselId === highlightedVesselId || vesselId === companionVesselId;
                    })
                    .map((vesselId) => {
                      const emphasis = mode === "FLEET_OVERVIEW" ? { width: 3, opacity: 1 } : routeEmphasis(vesselId);
                      const d = pathGenerator({
                        type: "LineString",
                        coordinates: MAP_ROUTES[vesselId].map((p) => [p.lon, p.lat]),
                      });
                      return d ? (
                        <path
                          key={vesselId}
                          d={d}
                          fill="none"
                          stroke={MAP_VESSEL_COLOR[vesselId]}
                          strokeWidth={emphasis.width}
                          opacity={emphasis.opacity}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null;
                    })}
                {pathGenerator && selectedSimulatedRoute && (
                  <path
                    d={pathGenerator(selectedSimulatedRoute) ?? undefined}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    strokeDasharray="5 3"
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {pathGenerator && routeAHighlightPath && (
                  <path
                    d={pathGenerator(routeAHighlightPath) ?? undefined}
                    fill="none"
                    stroke={isApproved ? "#1d4ed8" : "#2563eb"}
                    strokeWidth={5}
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {pathGenerator &&
                  WAITING_SHIPS_NEAR_SINGAPORE.map((p, i) => {
                    const pt = projection?.([p.lon, p.lat]);
                    if (!pt) return null;
                    return (
                      <g key={i} transform={`translate(${pt[0]}, ${pt[1]}) scale(${markerScale})`}>
                        <circle r={2.5} fill="#f59e0b" opacity={0.8} />
                      </g>
                    );
                  })}
              </g>

              {!isDecisionMode && (
                <g className="vessel-marker-layer">
                  {/* 자사선은 GLOVIS 5척뿐이며 core-vessel-layer가 항상 별도로 그려주므로, 이 레이어는
                      타사(OTHER) 선박만 회색 점선 마커로 그린다. displaySimTime 기준으로 재계산된 위치를 쓴다. */}
                  {(anyFilterActive ? otherFleetDisplayPositions.filter(matchesFilters) : otherFleetDisplayPositions)
                      .map((vessel) => {
                      const pt = projection?.([vessel.longitude, vessel.latitude]);
                      if (!pt) return null;
                      const isSelected = selectedVesselId === vessel.id;
                      const isHovered = hoveredVesselId === vessel.id;
                      const showName = isSelected || isHovered;
                      const showSpeed = isSelected || isHovered;
                      return (
                        <g
                          key={vessel.id}
                          transform={`translate(${pt[0]}, ${pt[1]})`}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredVesselId(vessel.id)}
                          onMouseLeave={() => setHoveredVesselId((id) => (id === vessel.id ? null : id))}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedVesselId === vessel.id) {
                              setSelectedVesselId(null);
                              setActivePopup(null);
                            } else {
                              setSelectedVesselId(vessel.id);
                              setActivePopup({ kind: "vessel", id: vessel.id });
                            }
                          }}
                        >
                          <g transform={`scale(${markerScale})`}>
                            <circle
                              r={6}
                              fill="none"
                              stroke="#111827"
                              strokeWidth={1}
                              strokeDasharray="1.5 1.5"
                              opacity={0.7}
                              vectorEffect="non-scaling-stroke"
                            />
                            <circle r={4} fill="#111827" stroke="white" strokeWidth={1} />
                            {showName && (
                              <text y={-14} textAnchor="middle" fontSize={10} fontWeight={700} fill="#374151">
                                {vessel.displayName ?? vessel.id}
                                {showSpeed ? ` · ${vessel.speedKnots.toFixed(1)}kn` : ""}
                                {" · 타사"}
                              </text>
                            )}
                            <title>{`${vessel.displayName ?? vessel.id} · ${vessel.speedKnots}kn · 타사`}</title>
                          </g>
                        </g>
                      );
                    })}
                </g>
              )}

              {!isDecisionMode && (
                <g className="core-vessel-layer">
                  {corePositions.map((vessel) => {
                    const fleetVessel = combinedFleet.find((v) => v.id === vessel.id);
                    if (fleetVessel && !matchesFilters(fleetVessel)) return null;
                    const pt = projection?.([vessel.x, vessel.y]);
                    if (!pt) return null;
                    const isSelected = selectedVesselId === vessel.id;
                    const isHovered = hoveredVesselId === vessel.id;
                    return (
                      <g
                        key={vessel.id}
                        transform={`translate(${pt[0]}, ${pt[1]})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredVesselId(vessel.id)}
                        onMouseLeave={() => setHoveredVesselId((id) => (id === vessel.id ? null : id))}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 같은 선박을 다시 누르면 항로 강조를 해제하고 원래 상태로 되돌린다(토글).
                          if (isSelected) {
                            setSelectedVesselId(null);
                            setActivePopup(null);
                          } else {
                            setSelectedVesselId(vessel.id);
                            setActivePopup({ kind: "vessel", id: vessel.id });
                            // 세계 지도에서는 5척 모두 말라카·수에즈·지브롤터 구간을 그대로 공유해 겹쳐
                            // 보인다 — 선택한 배의 실제 항로 범위로 확대해야 출발항·목적항 차이가 보인다.
                            flyToBounds(MAP_ROUTES[vessel.id].map((p) => [p.lon, p.lat] as [number, number]));
                          }
                        }}
                      >
                        <g transform={`scale(${markerScale})`}>
                          {(isSelected || isHovered) && (
                            <circle r={11} fill="none" stroke={CORE_VESSEL_COLOR} strokeWidth={1.5} opacity={0.5} />
                          )}
                          <circle r={7} fill={CORE_VESSEL_COLOR} stroke="white" strokeWidth={2} />
                          <text y={-13} textAnchor="middle" fontSize={11} fontWeight={700} fill={CORE_VESSEL_COLOR}>
                            {vessel.name}
                            {isSelected || isHovered ? ` · ${vessel.speedKnots.toFixed(1)}kn` : ""}
                          </text>
                          <title>{`${vessel.name} · 핵심 시나리오 선박 · ${vessel.speedKnots.toFixed(1)}kn`}</title>
                        </g>
                      </g>
                    );
                  })}
                </g>
              )}

              {isDecisionMode && (
                <g className="vessel-layer">
                  {visibleDetailVessels.map((vessel) => {
                    const routeId = vessel.id as MapRouteVesselId;
                    const pos = resolveLiveVesselPos(routeId, currentSimTime);
                    if (!pos) return null;
                    const pt = projection?.([pos.x, pos.y]);
                    if (!pt) return null;
                    const isHighlighted = routeId === highlightedVesselId;
                    const danger = isHighlighted && decisionCausedDelayHours > 0;
                    const statusLabel = isHighlighted && isApproved ? "실행 중" : (resolveLiveStatusLabel(vessel.id, scenarioVesselRuntime) ?? "-");
                    return (
                      <g
                        key={vessel.id}
                        transform={`translate(${pt[0]}, ${pt[1]})`}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePopup({ kind: "vessel", id: vessel.id });
                        }}
                      >
                        <g transform={`scale(${markerScale})`}>
                          <circle r={isHighlighted ? 9 : 7} fill={danger ? "#dc2626" : MAP_VESSEL_COLOR[routeId]} stroke="white" strokeWidth={2} />
                          <text
                            y={isHighlighted ? -14 : -11}
                            textAnchor="middle"
                            fontSize={isHighlighted ? 12 : 11}
                            fontWeight={700}
                            fill={danger ? "#dc2626" : isHighlighted ? "#1d4ed8" : "#4b5563"}
                          >
                            {vessel.name}
                          </text>
                          {isHighlighted && (
                            <text y={0} dy={26} textAnchor="middle" fontSize={10} fontWeight={600} fill={danger ? "#dc2626" : "#1d4ed8"}>
                              {statusLabel}
                            </text>
                          )}
                        </g>
                      </g>
                    );
                  })}
                </g>
              )}

              <g className="port-layer">
                {/* 모든 항구를 초록 네모(항구 표시)로 항상 표시하고, 사건/기회가 있는 항구는 강조 링을 덧그린다. */}
                {visiblePorts.map((port) => {
                  const pt = projection?.([port.lon, port.lat]);
                  if (!pt) return null;
                  const isActive = port.hasIncident || port.hasOpportunity;
                  return (
                    <g
                      key={port.id}
                      transform={`translate(${pt[0]}, ${pt[1]})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopup({ kind: "port", id: port.id });
                      }}
                    >
                      <g transform={`scale(${markerScale})`}>
                        {isActive && (
                          <circle
                            r={13}
                            fill="none"
                            stroke={port.hasIncident ? "#dc2626" : "#0d9488"}
                            strokeWidth={1}
                            opacity={0.35}
                          />
                        )}
                        <rect x={-5} y={-5} width={10} height={10} fill="#059669" stroke="white" strokeWidth={1.5} />
                        <title>
                          {(() => {
                            if (!port.hasIncident) return port.hasOpportunity ? `${port.name} · 운항 기회 · 임시 선석` : port.name;
                            const info = resolvePortIncidentInfo(port.name, incidents);
                            return info
                              ? `${port.name} · ${info.eventTypeLabel} ${info.eventStatusLabel}${info.estimatedDurationHours !== null ? ` · 최소 ${info.estimatedDurationHours}h` : ""}`
                              : `${port.name} · 사건 발생`;
                          })()}
                        </title>
                      </g>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {landError && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow">
            {landError}
          </div>
        )}

        {scopedToAsia && (
          <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-md border border-blue-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-blue-700 shadow">
            전체 자사선 {VESSELS.length}척 중 이번 사건 관련 자사선 {visibleDetailVessels.length}척을 표시합니다.
          </div>
        )}

        {mapOverlay && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-2">{mapOverlay}</div>
        )}

        <MapLegend />

        <button
          type="button"
          onClick={resetToWorld}
          title="전체 선대 보기"
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-gray-600 shadow hover:bg-gray-50"
        >
          <Home size={15} />
        </button>

        {/* 선박 팝업 */}
        {activeVessel &&
          (() => {
            const screen = projectToScreen(activeVessel.longitude, activeVessel.latitude);
            if (!screen) return null;
            // isDecisionMode가 아니면(FLEET_OVERVIEW) highlightedVesselId/vesselACurrentSpeedKnots는
            // 호출부가 채워주지 않는 의미 없는 기본값이다 — 게이트 없이 비교하면 highlightedVesselId
            // 기본값("glovis-e")과 우연히 id가 같은 배를 클릭했을 때 실제 속도 대신 0kn(더미값)이 뜬다.
            const isHighlightedVessel = isDecisionMode && activeVessel.id === highlightedVesselId;
            const arrivalInfo = activeDetail ? resolveLiveArrivalInfo(activeDetail.id, currentSimTime, scenarioVesselRuntime) : null;
            const isDetailExpanded = expandedDetailVesselId === activeVessel.id;
            const scenarioDetail = activeDetail && isDetailExpanded ? resolveScenarioVesselDetailInfo(activeDetail.id, scenarioVesselRuntime) : null;
            return (
              <div
                className="absolute z-20 w-56 rounded-lg border border-gray-200 bg-white shadow-lg"
                style={{ left: screen[0] + 12, top: screen[1] + 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between rounded-t-lg border-b border-gray-100 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{activeDetail?.name ?? activeVessel.id}</p>
                    <p className="text-[11px] text-gray-500">{activeDetail ? activeDetail.vesselType : "시뮬레이션 선대"}</p>
                  </div>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${activeDetail ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {activeDetail ? "자사선" : "타사선"}
                  </span>
                </div>

                {/* 기본 정보 */}
                <dl className="space-y-1.5 px-3 py-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">현재 속도</dt>
                    <dd className="font-semibold text-gray-900">
                      {(isHighlightedVessel ? vesselACurrentSpeedKnots : activeVessel.speedKnots).toFixed(1)} kn
                    </dd>
                  </div>
                  {isHighlightedVessel && isApproved && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">목표 속도</dt>
                      <dd className="font-semibold text-teal-600">{vesselATargetSpeedKnots.toFixed(1)} kn</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">운항 상태</dt>
                    <dd className="font-semibold text-gray-900">
                      {activeDetail ? (resolveLiveStatusLabel(activeDetail.id, scenarioVesselRuntime) ?? "-") : activeVessel.alertStatus}
                    </dd>
                  </div>
                  {activeDetail && (() => {
                    const sv = SCENARIO_VESSELS.find((s) => s.id === activeDetail.id.toUpperCase());
                    if (!sv) return null;
                    const departed = currentSimTime >= new Date(sv.departureAtIso).getTime();
                    return (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">{departed ? "출발 시각" : "출발 예정"}</dt>
                        <dd className="font-semibold text-gray-900">{formatIsoLabel(sv.departureAtIso)}</dd>
                      </div>
                    );
                  })()}
                  {arrivalInfo && (
                    <>
                      {arrivalInfo.hasInterimLeg && (
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-gray-500">{arrivalInfo.interimPortName} 도착 예정</dt>
                          <dd className="font-semibold text-gray-900">{arrivalInfo.interimEtaLabel} <span className="text-[10px] font-normal text-gray-500">({arrivalInfo.interimDelayLabel})</span></dd>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-gray-500">최종 도착 · {arrivalInfo.finalPortName}</dt>
                        <dd className="font-semibold text-gray-900">{arrivalInfo.finalEtaLabel} <span className="text-[10px] font-normal text-gray-500">({arrivalInfo.finalDelayLabel})</span></dd>
                      </div>
                    </>
                  )}
                  {activeDetail && (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-gray-500">현재 항차</dt>
                        <dd className="line-clamp-2 font-semibold text-gray-900">{activeDetail.route.join(" → ")}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">일정 여유</dt>
                        <dd className="font-semibold text-gray-900">{activeDetail.scheduleBufferHours}시간</dd>
                      </div>
                    </>
                  )}
                </dl>

                {/* 상세 펼침 영역 */}
                {scenarioDetail && (
                  <dl className="space-y-1.5 border-t border-gray-100 px-3 py-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">선령</dt>
                      <dd className="font-semibold text-gray-900">{scenarioDetail.ageYears}년</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">기준 속도</dt>
                      <dd className="font-semibold text-gray-900">{scenarioDetail.baseSpeedKn.toFixed(1)} kn</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">최저 감속 하한</dt>
                      <dd className="font-semibold text-gray-900">{scenarioDetail.minSpeedKn.toFixed(1)} kn</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-gray-500">최근 속도 변경 시각</dt>
                      <dd className="font-semibold text-gray-900">{scenarioDetail.latestSpeedChangeLabel ?? "이력 없음"}</dd>
                    </div>
                  </dl>
                )}

                {/* 버튼 */}
                {activeDetail && (
                  <div className="border-t border-gray-100 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedDetailVesselId((id) => (id === activeVessel.id ? null : activeVessel.id))}
                      className="w-full rounded-md bg-gray-100 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      {isDetailExpanded ? "간단히 보기" : "선박 상세 보기"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

        {/* 사건/기회 항만 팝업 */}
        {activePort &&
          (() => {
            const screen = projectToScreen(activePort.lon, activePort.lat);
            if (!screen) return null;
            const isOpportunity = activePort.hasOpportunity;
            const isIncident = activePort.hasIncident;
            const incidentInfo = isIncident ? resolvePortIncidentInfo(activePort.name, incidents) : null;
            const portInfo = PORT_INFO_KO[activePort.id];
            return (
              <div
                className={`absolute z-20 w-56 rounded-lg border bg-white p-3 text-xs shadow-lg ${isOpportunity ? "border-teal-200" : isIncident ? "border-red-200" : "border-gray-200"}`}
                style={{ left: screen[0] + 14, top: screen[1] + 14 }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-bold text-gray-800">
                  {activePort.name}
                  {portInfo && <span className="font-normal text-gray-500"> · {portInfo.koreanName}</span>}
                </p>
                {portInfo && <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{portInfo.description}</p>}
                {!isOpportunity && !isIncident ? null : isOpportunity ? (
                  <>
                    <p className="mb-1.5 mt-2 text-xs font-semibold text-teal-700">임시 선석 기회</p>
                    <dl className="space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">수용시간</dt>
                        <dd className="font-medium text-gray-800">16:30~18:00</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">즉시 판단</dt>
                        <dd className="font-medium text-gray-800">
                          {activePortVesselNames.length > 0 ? activePortVesselNames.join(", ") : "-"}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="mb-1.5 mt-2 text-xs font-semibold text-red-700">{incidentInfo?.eventTypeLabel ?? "사건"} 발생</p>
                    <dl className="space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">진행 상태</dt>
                        <dd className="font-medium text-gray-800">{incidentInfo?.eventStatusLabel ?? "진행 중"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">예상 지속시간</dt>
                        <dd className="font-medium text-gray-800">
                          {incidentInfo?.estimatedDurationHours !== null && incidentInfo?.estimatedDurationHours !== undefined
                            ? `최소 ${incidentInfo.estimatedDurationHours}시간`
                            : "-"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">즉시 판단</dt>
                        <dd className="font-medium text-gray-800">
                          {activePortVesselNames.length > 0 ? activePortVesselNames.join(", ") : "-"}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
