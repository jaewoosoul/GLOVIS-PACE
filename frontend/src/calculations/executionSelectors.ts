import { useMemo } from "react";
import { useExecutionRecordsStore, type ExecutionRecord } from "../stores/executionRecordsStore";
import { useIncidentStore, type Incident } from "../stores/incidentStore";
import { useNewsStore } from "../stores/newsStore";
import { useAlertsStore } from "../stores/alertsStore";
import type { NewsItem } from "../stores/newsStore";
import type { Signal } from "../types/signal";
import { calculateExecutionProgress } from "./executionSimulation";
import { adaptIncidentOptionsToSpeedOptions } from "./incidentOptionAdapter";
import type { DecisionStatus, ExecutionStageLabel, ExecutionSummary } from "../types/decision";
import { formatIsoLabel, formatUsd } from "../lib/format";

/** decisionStatus + 실행 클릭 진행 상태를 명세된 단계 라벨 어휘로 매핑한다. */
function resolveStageLabel(decisionStatus: DecisionStatus, captainAcknowledged: boolean, speedChangeStarted: boolean): ExecutionStageLabel {
  if (decisionStatus === "COMPLETED") return "확정 발효";
  if (decisionStatus === "MONITORING") return "목표 속도 도달 · 모니터링 중";
  if (speedChangeStarted) return "속도 변경 중";
  if (captainAcknowledged) return "지시 전달 완료";
  return "잠정 발효";
}

/**
 * executionRecordsStore(승인된 판단마다 독립된 영속 레코드)에 있는 모든 승인 건을 화면용
 * ExecutionSummary로 변환한다. decisionStore(화면에 지금 띄운 선박 1건)에서 읽지 않는다 —
 * 그렇게 하면 여러 선박이 동시에 승인돼도 마지막 1건만 보이던 문제가 재발한다.
 */
export function useActiveExecutionSummaries(): ExecutionSummary[] {
  const records = useExecutionRecordsStore((s) => s.records);
  const incidents = useIncidentStore((s) => s.incidents);
  const newsItems = useNewsStore((s) => s.items);
  const alerts = useAlertsStore((s) => s.alerts);

  return useMemo(() => {
    return Object.values(records)
      .sort((a, b) => b.approvedAt - a.approvedAt)
      .map((record) => buildSummary(record, incidents, newsItems, alerts))
      .filter((summary): summary is ExecutionSummary => summary !== null);
  }, [records, incidents, newsItems, alerts]);
}

function buildSummary(
  record: ExecutionRecord,
  incidents: Record<string, Incident>,
  newsItems: NewsItem[],
  alerts: Signal[],
): ExecutionSummary | null {
  if (!record.incidentId) return null;
  const incident = incidents[record.incidentId];
  const vesselEntry = incident?.provisionalByVessel.find((v) => v.vesselId === record.vesselId);
  if (!incident || !vesselEntry) return null;

  const options = adaptIncidentOptionsToSpeedOptions(vesselEntry.calculation);
  const selected = options.find((o) => o.optionId === record.selectedOptionId) ?? options[0];
  if (!selected) return null;
  const baselineSpeedKnots = options.find((o) => o.optionId === "A")?.speedKnots ?? selected.speedKnots;
  const progress = calculateExecutionProgress(record.executionClickCount, baselineSpeedKnots, selected.speedKnots);

  const rawSelectedOption = vesselEntry.calculation.options[options.indexOf(selected)];
  const currentEtaLabel = formatIsoLabel(rawSelectedOption.candidateArrivalIso);

  const newsTitle = newsItems.find((n) => n.incidentId === record.incidentId && n.sourceType === "NEWS")?.title;
  const signal = alerts.find((a) => a.linkedIncidentId === record.incidentId);

  return {
    recordId: record.recordId,
    decisionId: incident.incidentId,
    vesselId: vesselEntry.vesselId,
    vesselName: vesselEntry.vesselName,
    incidentTitle: signal?.title ?? newsTitle ?? `${incident.portName} 사건`,
    port: incident.portName,
    mode: "SLOW_DOWN",
    modeLabel: "감속",
    optionId: selected.optionId,
    baseSpeedKnots: baselineSpeedKnots,
    targetSpeedKnots: selected.speedKnots,
    currentSpeedKnots: progress.currentSpeedKnots,
    approvedAt: record.approvedAt,
    stageLabel: resolveStageLabel(record.decisionStatus, progress.captainAcknowledged, progress.speedChangeStarted),
    captainAcknowledged: progress.captainAcknowledged,
    actualSpeedApplied: progress.targetReached,
    costLabel: `${formatUsd(selected.fuelCostSavedUsd)} 연료비 절감`,
    currentEtaLabel,
    revokeDeadlineAt: record.revokeDeadlineAt,
  };
}
