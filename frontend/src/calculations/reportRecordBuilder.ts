import { useIncidentStore, type Incident, type VesselConfirmed } from "../stores/incidentStore";
import { useNewsStore } from "../stores/newsStore";
import { useReportStore } from "../stores/reportStore";
import { useSimulationStore } from "../stores/simulationStore";
import { EVENT_TYPE_MAP, EVENT_STATUS_MAP } from "./incidentOptionAdapter";
import { NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS } from "./scenarioDecisionCalculations";
import {
  V7_FUEL_PRICE_USD_PER_TON,
  V7_ANCHORAGE_FUEL_TON_PER_DAY,
  V7_CO2_TON_PER_FUEL_TON,
  sailingFuelTon,
  anchorageFuelTon,
  requiredSpeedKn,
  candidateArrivalAt,
  arrivalTiming,
} from "./scenarioCalculations";
import { SCENARIO_VESSELS } from "../data/scenarioVessels";
import type { VesselDecisionCalculation } from "../types/scenarioDecision";
import type {
  CompletedDecisionRecord,
  ReportTimelineEntry,
  ReportAiJudgment,
  ReportCalculationDetail,
  ReportComparisonPoint,
  ReportNewsArticle,
} from "../types/report";

const SEVERITY_LABEL: Record<string, string> = {
  NONE: "없음",
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  CRITICAL: "심각",
};

/**
 * 리포트 1~3페이지(기사/AI 판단/계산식/전후 비교)에 쓰는 상세 데이터를 한 번에 뽑는다.
 * 뉴스 분석 파이프라인을 탄 실제 사건 판단(INCIDENT_POST_RTA)에서만 채울 수 있다 —
 * calc(원본 3옵션 계산 결과)가 없으면(레거시) 빈 값을 돌려준다.
 */
function buildIncidentDetailFields(input: {
  incident: Incident;
  vesselId: string;
  calc: VesselDecisionCalculation | null;
  calculationAtIso: string | null;
  selectedSpeedKn: number;
  /** calc를 만들 때 calculateVesselDecision에 실제로 넘긴 증분 지연 — 없으면(레거시) null. */
  additionalDelayHours: number | null;
  /** 뉴스 접수(1차) 시점에 확정했던 속도(VesselConfirmed.priorSpeedKn) — 1차 옵션 표의 선택 표시용. */
  provisionalSelectedSpeedKn?: number;
}): {
  newsArticle?: ReportNewsArticle;
  aiJudgment?: ReportAiJudgment;
  calculationDetail?: ReportCalculationDetail;
  comparisonBaseline?: ReportComparisonPoint;
  comparisonSelected?: ReportComparisonPoint;
} {
  const newsItem = useNewsStore
    .getState()
    .items.find((n) => n.incidentId === input.incident.incidentId && n.sourceType === "NEWS");
  const newsArticle: ReportNewsArticle | undefined = newsItem
    ? { title: newsItem.title, body: newsItem.body, source: newsItem.source, publishedAtLabel: newsItem.publishedAtLabel }
    : undefined;

  const analysis = input.incident.newsAnalysis;
  const aiJudgment: ReportAiJudgment | undefined = analysis
    ? {
        summary: analysis.summary,
        eventTypeLabel: EVENT_TYPE_MAP[analysis.eventType],
        eventStatusLabel: EVENT_STATUS_MAP[analysis.eventStatus],
        severityLabel: SEVERITY_LABEL[analysis.severity] ?? analysis.severity,
        confidencePercent: Math.round(analysis.confidence * 100),
        estimatedDelayHours: analysis.timing.reportedDelayHours?.min ?? analysis.timing.reportedDurationHours?.min ?? null,
        evidence: analysis.evidence.map((e) => e.quote),
      }
    : undefined;

  const scenarioVessel = SCENARIO_VESSELS.find((v) => v.id === input.vesselId);
  const provisionalCalc = input.incident.provisionalByVessel.find((p) => p.vesselId === input.vesselId)?.calculation;
  const provisionalOptions = provisionalCalc
    ? provisionalCalc.options.map((o) => ({
        kind: o.kind,
        label: o.label,
        speedKn: o.speedKn,
        waitHours: o.waitHours,
        downstreamDelayHours: o.downstreamDelayHours,
        fuelSavedTon: o.fuelSavedTon,
        fuelSavedUsd: o.fuelSavedUsd,
        isSelected:
          input.provisionalSelectedSpeedKn !== undefined && Math.abs(o.speedKn - input.provisionalSelectedSpeedKn) < 0.01,
      }))
    : undefined;
  const maintainOption = input.calc?.options.find((o) => o.kind === "MAINTAIN");
  const requiredOption = input.calc?.options.find((o) => o.kind === "REQUIRED");
  const selectedOption = input.calc?.options.find((o) => Math.abs(o.speedKn - input.selectedSpeedKn) < 0.01) ?? maintainOption;

  if (!input.calc || !input.calculationAtIso || !scenarioVessel || !maintainOption || !selectedOption || input.additionalDelayHours === null) {
    return { newsArticle, aiJudgment };
  }

  const berthAvailableAtIso = (maintainOption.waitHours > 0 ? maintainOption.berthingAtIso : requiredOption?.berthingAtIso) ?? selectedOption.berthingAtIso;
  const delayHoursToAbsorb = (new Date(berthAvailableAtIso).getTime() - new Date(scenarioVessel.originalAssignedEtaIso).getTime()) / 3_600_000;
  const sailingHoursFor = (speedKn: number) => input.calc!.remainingDistanceNm / speedKn;
  // maintainOption.speedKn은 calculateVesselDecision 호출 시 넘긴 currentApprovedSpeedKn 그대로다 —
  // 필요 속도 공식을 리포트에서 다시 보여줄 때도 그 값을 그대로 재사용해 실제 계산과 어긋나지 않게 한다.
  const requiredSpeedKnRaw = requiredSpeedKn({
    remainingDistanceNm: input.calc.remainingDistanceNm,
    currentSpeedKn: maintainOption.speedKn,
    additionalDelayHours: input.additionalDelayHours,
  });

  const calculationDetail: ReportCalculationDetail = {
    remainingDistanceNm: input.calc.remainingDistanceNm,
    baseSpeedKn: scenarioVessel.baseSpeedKn,
    minSpeedKn: scenarioVessel.minSpeedKn,
    delayHoursToAbsorb,
    additionalDelayHours: input.additionalDelayHours,
    requiredSpeedKnRaw,
    maxAbsorbableDelayHours: input.calc.maxAbsorbableDelayHours,
    candidateArrivalIso: selectedOption.candidateArrivalIso,
    berthingAtIso: selectedOption.berthingAtIso,
    originalArrivalAtIso: scenarioVessel.originalAssignedEtaIso,
    departureAtIso: scenarioVessel.departureAtIso,
    finalArrivalAtIso: scenarioVessel.finalArrivalAtIso,
    waitHours: selectedOption.waitHours,
    sailingHours: sailingHoursFor(selectedOption.speedKn),
    fuelPriceUsdPerTon: V7_FUEL_PRICE_USD_PER_TON,
    anchorageFuelTonPerDay: V7_ANCHORAGE_FUEL_TON_PER_DAY,
    co2FactorTonPerFuelTon: V7_CO2_TON_PER_FUEL_TON,
    allOptions: input.calc.options.map((o) => ({
      kind: o.kind,
      label: o.label,
      speedKn: o.speedKn,
      waitHours: o.waitHours,
      downstreamDelayHours: o.downstreamDelayHours,
      fuelSavedTon: o.fuelSavedTon,
      fuelSavedUsd: o.fuelSavedUsd,
      isSelected: o === selectedOption,
    })),
    provisionalOptions,
  };

  const pointFor = (option: { speedKn: number; waitHours: number }, label: string, berthingAtIso: string): ReportComparisonPoint => {
    const sailingHours = sailingHoursFor(option.speedKn);
    const fuelTon = sailingFuelTon(option.speedKn, sailingHours) + anchorageFuelTon(option.waitHours);
    return {
      label,
      speedKn: option.speedKn,
      sailingHours,
      waitHours: option.waitHours,
      fuelTon,
      costUsd: fuelTon * V7_FUEL_PRICE_USD_PER_TON,
      co2Ton: fuelTon * V7_CO2_TON_PER_FUEL_TON,
      berthingAtIso,
    };
  };

  // "전 · 후 비교"는 MAINTAIN 옵션(=이미 1차로 감속된 속도를 그대로 유지)이 아니라, 사건을 몰랐다면
  // 계속 탔을 원래 기준 속도(scenarioVessel.baseSpeedKn, 뉴스 접수 전 속도)를 지금 이 시점부터 그대로
  // 유지했을 때와 비교한다 — 같은 잔여거리·같은 선석 가용 시각을 기준으로 계산해 "뉴스 전 속도 vs
  // RTA 확정 후 최종 속도"를 공정하게 대조한다.
  const preNewsArrivalIso = candidateArrivalAt(input.calculationAtIso, input.calc.remainingDistanceNm, scenarioVessel.baseSpeedKn);
  const preNewsTiming = arrivalTiming(preNewsArrivalIso, berthAvailableAtIso);

  return {
    newsArticle,
    aiJudgment,
    calculationDetail,
    comparisonBaseline: pointFor(
      { speedKn: scenarioVessel.baseSpeedKn, waitHours: preNewsTiming.waitHours },
      "뉴스 전 속도 유지(개입 없음)",
      preNewsTiming.berthingAtIso,
    ),
    comparisonSelected: pointFor(selectedOption, `RTA 확정 후 ${selectedOption.label}`, selectedOption.berthingAtIso),
  };
}

/**
 * incidentStore가 방금 특정 선박을 revisionConfirmed=true로 확정해 사건 전체가 COMPLETED가 됐을 때
 * 호출한다. RTA 확정치까지 반영된 최종 판단만 리포트에 남긴다 — 뉴스 추정치만으로 승인된 시점에는
 * 리포트를 만들지 않는다(같은 사건이 두 번 리포트에 뜨는 걸 막기 위함).
 */
export function buildIncidentCompletedRecord(
  incident: Incident,
  vessel: VesselConfirmed,
  newsTitle: string,
  decidedAtIso: string,
): CompletedDecisionRecord {
  // 뉴스/RTA 접수 시각이 시뮬레이션 가상시계 기준이라, 재확정·완료도 실제 시각 대신 같은
  // 가상시계로 남겨야 타임라인이 시간 역순으로 보이지 않는다.
  const simNowIso = new Date(useSimulationStore.getState().currentSimTime).toISOString();
  const timeline: ReportTimelineEntry[] = [];
  if (incident.newsReceivedAtIso) {
    timeline.push({ label: "뉴스 접수", atIso: incident.newsReceivedAtIso });
    timeline.push({ label: "속도 1차 확정", atIso: new Date(new Date(incident.newsReceivedAtIso).getTime() + 2 * 60_000).toISOString() });
  }
  if (incident.rtaReceivedAtIso) {
    timeline.push({ label: "RTA 확정 통보", atIso: incident.rtaReceivedAtIso });
    timeline.push({ label: "속도 최종 확정", atIso: new Date(new Date(incident.rtaReceivedAtIso).getTime() + 3 * 60_000).toISOString() });
  }

  const recalculated = vessel.revision;
  const targetSpeedKnots = vessel.priorSpeedKn;
  const matchedOption = recalculated?.options.find((o) => Math.abs(o.speedKn - targetSpeedKnots) < 0.01);

  const detail = buildIncidentDetailFields({
    incident,
    vesselId: vessel.vesselId,
    calc: recalculated,
    calculationAtIso: incident.rtaReceivedAtIso,
    selectedSpeedKn: targetSpeedKnots,
    additionalDelayHours: vessel.additionalDelayHoursApplied,
    provisionalSelectedSpeedKn: vessel.priorSpeedKn,
  });

  // 리포트 전체(1p 절감 요약, 2p 계산식, 3p 전후 비교)가 "뉴스 전 속도 vs RTA 확정 후 최종 속도"
  // 기준으로 하나의 일관된 숫자를 보여주도록, detail.comparisonBaseline/comparisonSelected(뉴스 전
  // 속도 기준으로 새로 계산됨)에서 절감액을 도출한다 — RTA 재계산 내부의 MAINTAIN(이미 1차로 감속된
  // 속도) 대비 절감액과는 다른 값이다. detail이 없으면(계산 상세를 못 채운 예외 케이스) 기존처럼
  // RTA 재계산 옵션의 fuelSavedTon을 그대로 쓴다.
  const fuelSavedTons = detail.comparisonBaseline && detail.comparisonSelected
    ? detail.comparisonBaseline.fuelTon - detail.comparisonSelected.fuelTon
    : (matchedOption?.fuelSavedTon ?? 0);
  const netSavingsUsd = detail.comparisonBaseline && detail.comparisonSelected
    ? detail.comparisonBaseline.costUsd - detail.comparisonSelected.costUsd
    : (matchedOption?.fuelSavedUsd ?? 0);
  const co2AvoidedTons = detail.comparisonBaseline && detail.comparisonSelected
    ? detail.comparisonBaseline.co2Ton - detail.comparisonSelected.co2Ton
    : (matchedOption?.co2AvoidedTon ?? 0);
  const baseSpeedKnots = detail.calculationDetail?.baseSpeedKn ?? recalculated?.options[0]?.speedKn ?? targetSpeedKnots;

  return {
    id: `incident-post-rta:${incident.incidentId}:${vessel.vesselId}:${decidedAtIso}`,
    source: "INCIDENT_POST_RTA",
    vesselId: vessel.vesselId,
    vesselName: vessel.vesselName,
    incidentTitle: newsTitle || `${incident.portName} 사건`,
    port: incident.portName,
    mode: "SLOW_DOWN",
    modeLabel: "감속",
    optionLabel: matchedOption ? matchedOption.label : "현재 속도 유지",
    baseSpeedKnots,
    targetSpeedKnots,
    reason: incident.newsAnalysis?.summary ?? `${incident.portName} 사건 RTA 확정치 반영`,
    netSavingsUsd,
    fuelSavedTons,
    co2AvoidedTons,
    // downstreamDelayHours를 그대로 쓰지 않고 incidentOptionAdapter와 동일한 잔여-오차 스냅
    // 규칙(NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS)을 거친다 — 리포트가 다른 화면과 다른 값을 보여주면 안 된다.
    decisionCausedDelayHours:
      matchedOption && matchedOption.downstreamDelayHours > NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS ? matchedOption.downstreamDelayHours : 0,
    timeline,
    approvedAt: decidedAtIso,
    completedAt: simNowIso,
    ...detail,
  };
}

/**
 * incidentStore.incidents의 각 사건 status가 COMPLETED로 새로 바뀌는 순간을 구독해, 그 사건의
 * 확정된(UNMATCHED 제외) 선박마다 레코드를 쌓는다. incidentStore 쪽에서 이 파일을 import하면
 * 순환 의존이 생기므로 위 decisionStore 구독과 같은 이유로 반대 방향(구독)으로 연결한다.
 */
useIncidentStore.subscribe((state, prevState) => {
  for (const incidentId of Object.keys(state.incidents)) {
    const incident = state.incidents[incidentId];
    const prevIncident = prevState.incidents[incidentId];
    if (incident.status !== "COMPLETED" || prevIncident?.status === "COMPLETED") continue;

    const newsTitle = useNewsStore
      .getState()
      .items.find((n) => n.incidentId === incidentId && n.sourceType === "NEWS")?.title ?? "";

    for (const vessel of incident.confirmedDelayByVessel) {
      if (vessel.comparisonStatus === "UNMATCHED") continue;
      const decidedAtIso = incident.decidedAtByVessel[vessel.vesselId] ?? new Date(useSimulationStore.getState().currentSimTime).toISOString();
      const record = buildIncidentCompletedRecord(incident, vessel, newsTitle, decidedAtIso);
      useReportStore.getState().addRecord(record);
    }
  }
});
