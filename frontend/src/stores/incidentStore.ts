import { create } from "zustand";
import { persist } from "zustand/middleware";
import { calculateVesselDecision } from "../calculations/scenarioDecisionCalculations";
import { remainingDistanceAt } from "../calculations/scenarioCalculations";
import { vesselsForDestinationPort } from "../data/scenarioVessels";
import { useScenarioVesselStore } from "./scenarioVesselStore";
import { useExecutionRecordsStore, buildRecordId } from "./executionRecordsStore";
import type { NewsAnalysis } from "../types/newsAnalysis";
import type { RtaAnalysis, RtaEtaBand } from "../types/rtaAnalysis";
import type { VesselDecisionCalculation } from "../types/scenarioDecision";

export type IncidentStatus =
  | "NEWS_ONLY"
  | "DECIDED"
  | "VERIFIED_UNCHANGED"
  | "REVIEW_REQUIRED_INCREASED_DELAY"
  | "REVIEW_REQUIRED_REDUCED_DELAY"
  | "COMPLETED";
export type VesselComparisonStatus = "VERIFIED_UNCHANGED" | "REVIEW_REQUIRED_INCREASED_DELAY" | "REVIEW_REQUIRED_REDUCED_DELAY" | "UNMATCHED";

export interface VesselProvisional {
  vesselId: string;
  vesselName: string;
  calculation: VesselDecisionCalculation;
}

export interface VesselConfirmed {
  vesselId: string;
  vesselName: string;
  originalAssignedEtaIso: string;
  matchedBand: RtaEtaBand | null;
  confirmedDelayHours: number | null;
  priorSpeedKn: number;
  comparisonStatus: VesselComparisonStatus;
  /** REVIEW_REQUIRED_*일 때만 채워진다. VERIFIED_UNCHANGED면 재계산 자체를 하지 않고 현재 속도를 유지한다(§6.2). */
  revision: VesselDecisionCalculation | null;
  /** revision 계산에 실제 넘긴 additionalDelayHours. UNMATCHED이거나 revision이 없으면 null. */
  additionalDelayHoursApplied: number | null;
  /** REVIEW_REQUIRED_*는 confirmRevision 후 true. VERIFIED_UNCHANGED/UNMATCHED는 즉시 true. */
  revisionConfirmed: boolean;
}

export interface Incident {
  incidentId: string;
  portCode: string;
  portName: string;
  newsAnalysis: NewsAnalysis | null;
  newsReceivedAtIso: string | null;
  /** 뉴스가 보도한 "추정" 지연시간(대표값 한 개, HourRange의 max 우선). */
  provisionalDelayHours: number | null;
  provisionalByVessel: VesselProvisional[];
  decidedSpeedByVessel: Record<string, number>;
  /** decidedSpeedByVessel과 짝을 이루는 결정 시각(ISO) — 리포트 타임라인/정렬에 쓴다. */
  decidedAtByVessel: Record<string, string>;
  rtaAnalysis: RtaAnalysis | null;
  rtaReceivedAtIso: string | null;
  confirmedDelayByVessel: VesselConfirmed[];
  status: IncidentStatus;
}

interface IncidentState {
  incidents: Record<string, Incident>;
  upsertNewsAnalysis: (input: {
    incidentId: string;
    portCode: string;
    portName: string;
    newsAnalysis: NewsAnalysis;
    receivedAtIso: string;
  }) => void;
  upsertRtaAnalysis: (input: { incidentId: string; rtaAnalysis: RtaAnalysis; receivedAtIso: string }) => void;
  decideSpeed: (incidentId: string, vesselId: string, speedKn: number, atIso: string) => void;
  /** RTA 확정 후 재검토가 필요한 선박의 재계산 속도안을 담당자가 최종 확정할 때 호출한다. */
  confirmRevision: (incidentId: string, vesselId: string, speedKn: number, atIso: string) => void;
  reset: () => void;
}

/** RTA 확정 이후 사건 전체 상태를 계산한다: 재검토가 남아있으면 그 사유를, 모두 해소됐으면 COMPLETED를 반환한다. */
function computeStatusAfterRta(confirmedDelayByVessel: VesselConfirmed[]): IncidentStatus {
  const unresolved = confirmedDelayByVessel.find((v) => !v.revisionConfirmed);
  if (unresolved) return unresolved.comparisonStatus as IncidentStatus;
  return "COMPLETED";
}

function representativeDelayHours(analysis: NewsAnalysis): number | null {
  const range = analysis.timing.reportedDelayHours;
  if (!range) return null;
  return range.max ?? range.min;
}

/** originalAssignedEta가 속한 RTA 구간을 찾는다. 조정 후 도착시각으로는 재매칭하지 않는다. */
export function matchBand(originalAssignedEtaIso: string, bands: RtaEtaBand[]): RtaEtaBand | null {
  const t = new Date(originalAssignedEtaIso).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  for (const band of bands) {
    if (!band.fromEtaIso) continue;
    const from = new Date(band.fromEtaIso).getTime();
    if (band.isOpenEnded || !band.toEtaIso) {
      if (t >= from) return band;
      continue;
    }
    const to = new Date(band.toEtaIso).getTime() + ONE_DAY_MS - 1;
    if (t >= from && t <= to) return band;
  }
  return null;
}

function compareDelay(provisional: number, confirmed: number): "VERIFIED_UNCHANGED" | "REVIEW_REQUIRED_INCREASED_DELAY" | "REVIEW_REQUIRED_REDUCED_DELAY" {
  if (confirmed === provisional) return "VERIFIED_UNCHANGED";
  return confirmed > provisional ? "REVIEW_REQUIRED_INCREASED_DELAY" : "REVIEW_REQUIRED_REDUCED_DELAY";
}

function emptyIncident(incidentId: string, portCode: string, portName: string): Incident {
  return {
    incidentId,
    portCode,
    portName,
    newsAnalysis: null,
    newsReceivedAtIso: null,
    provisionalDelayHours: null,
    provisionalByVessel: [],
    decidedSpeedByVessel: {},
    decidedAtByVessel: {},
    rtaAnalysis: null,
    rtaReceivedAtIso: null,
    confirmedDelayByVessel: [],
    status: "NEWS_ONLY",
  };
}

export const useIncidentStore = create<IncidentState>()(
  persist(
    (set, get) => ({
      incidents: {},

      upsertNewsAnalysis: ({ incidentId, portCode, portName, newsAnalysis, receivedAtIso }) => {
        const existing = get().incidents[incidentId] ?? emptyIncident(incidentId, portCode, portName);
        const provisionalDelayHours = representativeDelayHours(newsAnalysis);
        const runtimeVessels = useScenarioVesselStore.getState().vessels;
        // 항해를 이미 마친(COMPLETED) 선박은 새 사건과 매칭하지 않는다 — 정적 데이터가 아니라
        // 실제 런타임 상태로 판정해야, 전체 재생 모드에서 되살아난 GLOVIS-A도 정상 매칭된다.
        const vessels = vesselsForDestinationPort(portCode).filter((v) => runtimeVessels[v.id]?.status !== "COMPLETED");

        const provisionalByVessel: VesselProvisional[] =
          provisionalDelayHours === null
            ? []
            : vessels.map((v) => {
                const runtime = runtimeVessels[v.id];
                const remainingDistanceNm = remainingDistanceAt(v.legDistanceNm, v.departureAtIso, v.baseSpeedKn, runtime.speedHistory, receivedAtIso);
                const calculation = calculateVesselDecision({
                  vessel: v,
                  currentApprovedSpeedKn: v.baseSpeedKn,
                  remainingDistanceNm,
                  calculationAtIso: receivedAtIso,
                  additionalDelayHours: provisionalDelayHours,
                  totalDelayHours: provisionalDelayHours,
                });
                return { vesselId: v.id, vesselName: v.id, calculation };
              });

        const updated: Incident = {
          ...existing,
          portCode,
          portName,
          newsAnalysis,
          newsReceivedAtIso: receivedAtIso,
          provisionalDelayHours,
          provisionalByVessel,
          status: existing.rtaAnalysis ? existing.status : "NEWS_ONLY",
        };
        set((state) => ({ incidents: { ...state.incidents, [incidentId]: updated } }));
      },

      decideSpeed: (incidentId, vesselId, speedKn, atIso) => {
        const incident = get().incidents[incidentId];
        if (!incident || !incident.newsReceivedAtIso) return;

        useScenarioVesselStore.getState().applySpeedDecision(vesselId, speedKn, incident.newsReceivedAtIso);

        const updated: Incident = {
          ...incident,
          decidedSpeedByVessel: { ...incident.decidedSpeedByVessel, [vesselId]: speedKn },
          decidedAtByVessel: { ...incident.decidedAtByVessel, [vesselId]: atIso },
          status: incident.rtaAnalysis ? incident.status : "DECIDED",
        };
        set((state) => ({ incidents: { ...state.incidents, [incidentId]: updated } }));
      },

      upsertRtaAnalysis: ({ incidentId, rtaAnalysis, receivedAtIso }) => {
        const existing = get().incidents[incidentId];
        if (!existing) return; // RTA는 반드시 기존 NEWS 사건을 갱신한다 — 새 사건을 만들지 않는다.

        const runtimeVessels = useScenarioVesselStore.getState().vessels;
        const vessels = vesselsForDestinationPort(existing.portCode).filter((v) => runtimeVessels[v.id]?.status !== "COMPLETED");

        const confirmedDelayByVessel: VesselConfirmed[] = vessels.map((v) => {
          const matchedBand = matchBand(v.originalAssignedEtaIso, rtaAnalysis.etaBands);
          const confirmedDelayHours = matchedBand ? matchedBand.adjustmentHours : null;
          const priorSpeedKn = existing.decidedSpeedByVessel[v.id] ?? v.baseSpeedKn;

          if (confirmedDelayHours === null || existing.provisionalDelayHours === null) {
            return {
              vesselId: v.id,
              vesselName: v.id,
              originalAssignedEtaIso: v.originalAssignedEtaIso,
              matchedBand,
              confirmedDelayHours,
              priorSpeedKn,
              comparisonStatus: "UNMATCHED",
              revision: null,
              additionalDelayHoursApplied: null,
              revisionConfirmed: true,
            };
          }

          const comparisonStatus = compareDelay(existing.provisionalDelayHours, confirmedDelayHours);

          const runtime = runtimeVessels[v.id];
          const remainingDistanceNm = remainingDistanceAt(v.legDistanceNm, v.departureAtIso, v.baseSpeedKn, runtime.speedHistory, receivedAtIso);

          if (comparisonStatus === "VERIFIED_UNCHANGED") {
            const revision = calculateVesselDecision({
              vessel: v,
              currentApprovedSpeedKn: priorSpeedKn,
              remainingDistanceNm,
              calculationAtIso: receivedAtIso,
              additionalDelayHours: 0,
              totalDelayHours: confirmedDelayHours,
            });
            return {
              vesselId: v.id,
              vesselName: v.id,
              originalAssignedEtaIso: v.originalAssignedEtaIso,
              matchedBand,
              confirmedDelayHours,
              priorSpeedKn,
              comparisonStatus,
              revision,
              additionalDelayHoursApplied: 0,
              revisionConfirmed: false,
            };
          }

          let revision: VesselDecisionCalculation;
          let additionalDelayHoursApplied: number;
          if (comparisonStatus === "REVIEW_REQUIRED_INCREASED_DELAY") {
            additionalDelayHoursApplied = confirmedDelayHours - existing.provisionalDelayHours;
            revision = calculateVesselDecision({
              vessel: v,
              currentApprovedSpeedKn: priorSpeedKn,
              remainingDistanceNm,
              calculationAtIso: receivedAtIso,
              additionalDelayHours: additionalDelayHoursApplied,
              totalDelayHours: confirmedDelayHours,
            });
          } else {
            // 확정 < 추정: 음수 증분 불가 → confirmedDelayHours를 목표 총 지연으로 재계산
            additionalDelayHoursApplied = confirmedDelayHours;
            revision = calculateVesselDecision({
              vessel: v,
              currentApprovedSpeedKn: priorSpeedKn,
              remainingDistanceNm,
              calculationAtIso: receivedAtIso,
              additionalDelayHours: additionalDelayHoursApplied,
              totalDelayHours: confirmedDelayHours,
            });
          }

          return {
            vesselId: v.id,
            vesselName: v.id,
            originalAssignedEtaIso: v.originalAssignedEtaIso,
            matchedBand,
            confirmedDelayHours,
            priorSpeedKn,
            comparisonStatus,
            revision,
            additionalDelayHoursApplied,
            revisionConfirmed: false,
          };
        });

        const status = computeStatusAfterRta(confirmedDelayByVessel);

        const updated: Incident = { ...existing, rtaAnalysis, rtaReceivedAtIso: receivedAtIso, confirmedDelayByVessel, status };
        set((state) => ({ incidents: { ...state.incidents, [incidentId]: updated } }));
      },

      confirmRevision: (incidentId, vesselId, speedKn, atIso) => {
        const incident = get().incidents[incidentId];
        if (!incident || !incident.rtaReceivedAtIso) return;

        useScenarioVesselStore.getState().applySpeedDecision(vesselId, speedKn, incident.rtaReceivedAtIso);
        useExecutionRecordsStore.getState().complete(buildRecordId(incidentId, vesselId));

        const confirmedDelayByVessel = incident.confirmedDelayByVessel.map((v) =>
          v.vesselId === vesselId ? { ...v, priorSpeedKn: speedKn, revisionConfirmed: true } : v,
        );
        const status = computeStatusAfterRta(confirmedDelayByVessel);

        const updated: Incident = {
          ...incident,
          decidedSpeedByVessel: { ...incident.decidedSpeedByVessel, [vesselId]: speedKn },
          decidedAtByVessel: { ...incident.decidedAtByVessel, [vesselId]: atIso },
          confirmedDelayByVessel,
          status,
        };
        set((state) => ({ incidents: { ...state.incidents, [incidentId]: updated } }));
      },

      reset: () => set({ incidents: {} }),
    }),
    { name: "portpace-incidents-v7" },
  ),
);
