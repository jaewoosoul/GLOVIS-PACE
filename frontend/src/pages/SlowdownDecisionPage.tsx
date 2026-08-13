import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { FleetMap } from "../components/fleet/FleetMap";
import { IncidentRibbon } from "../components/signals/IncidentRibbon";
import { RecommendationCard } from "../components/decision/RecommendationCard";
import { ExecutionStatusCard } from "../components/execution/ExecutionStatusCard";
import { SpeedOptionGrid } from "../components/decision/SpeedOptionGrid";
import { DetailTabs, type DetailTab } from "../components/decision/DetailTabs";
import { ScheduleImpactTab } from "../components/decision/ScheduleImpactTab";
import { AiEvidenceTab } from "../components/signals/AiEvidenceTab";
import { ExecutionProgressTab } from "../components/execution/ExecutionProgressTab";
import { DocumentsTab } from "../components/execution/DocumentsTab";
import { MonitoringTab } from "../components/execution/MonitoringTab";
import { ApprovalBar } from "../components/decision/ApprovalBar";
import { ExecutionBar } from "../components/execution/ExecutionBar";
import { FinalReviewModal } from "../components/decision/FinalReviewModal";
import { ApprovalModal } from "../components/decision/ApprovalModal";
import { RevokeConfirmModal } from "../components/execution/RevokeConfirmModal";
import { SelectionComparisonRibbon } from "../components/decision/SelectionComparisonRibbon";
import { DelayChangeRiskWarning } from "../components/decision/DelayChangeRiskWarning";
import { useDecisionStore } from "../stores/decisionStore";
import { useSimulationStore } from "../stores/simulationStore";
import { useWorkflowStore } from "../stores/workflowStore";
import { useAlertsStore, selectPendingAlerts } from "../stores/alertsStore";
import { useShallow } from "zustand/react/shallow";
import { useIncidentStore } from "../stores/incidentStore";
import { useNewsStore } from "../stores/newsStore";
import { buildScheduleDomino } from "../calculations/slowdownCalculations";
import { calculateExecutionProgress } from "../calculations/executionSimulation";
import { adaptIncidentOptionsToSpeedOptions, adaptIncidentToPortEvent, pickIncidentRecommendedOptionId } from "../calculations/incidentOptionAdapter";
import { VESSELS } from "../data/fleetData";
import { useLiveCombinedFleet } from "../calculations/fleetSelectors";
import { formatIsoLabel } from "../lib/format";

const DRAFT_TAB_IDS = ["schedule", "ai"];
const EXECUTION_TAB_IDS = ["progress", "documents", "monitoring"];

/**
 * /decisions/incident/:incidentId(실제 뉴스·RTA 기반 사건)의 판단 화면. workflowStore.selectedIncidentId로
 * incidentStore에서 사건과 검토 대상 선박을 찾아, 그 선박의 실제 속도 옵션을
 * calculations/incidentOptionAdapter로 변환해 지도·탭·승인 흐름 컴포넌트에 그대로 넘긴다.
 */
export function SlowdownDecisionPage() {
  const {
    selectedOptionId,
    isHeld,
    reviewModalOpen,
    approvalModalOpen,
    decisionStatus,
    revokeDeadlineAt,
    executionClickCount,
    revokeConfirmOpen,
    selectOption,
    reset,
    hold,
    openReviewModal,
    cancelReviewModal,
    confirmApproval,
    closeApprovalModal,
    advanceExecution,
    openRevokeConfirm,
    cancelRevokeConfirm,
    confirmRevoke,
  } = useDecisionStore();
  const { selectedIncidentId, selectedVesselId, switchVessel } = useWorkflowStore();
  const { fleet: combinedFleet } = useLiveCombinedFleet();
  const resolveAlert = useAlertsStore((s) => s.resolveAlert);
  const alerts = useAlertsStore((s) => s.alerts);
  const pendingAlerts = useAlertsStore(useShallow(selectPendingAlerts));
  // 실제로 판단 대기 중인 사건만 지도에 항만 마커로 활성화한다 — FleetMapPage와 동일한 규칙(Singapore를
  // 사건 해소 후에도 항상 빨갛게 켜두지 않는다).
  const activeIncidentPortIds = useMemo(
    () => new Set(pendingAlerts.filter((a) => a.trigger !== "BERTH_SLOT_OPPORTUNITY").map((a) => a.port.toLowerCase())),
    [pendingAlerts],
  );
  const activeOpportunityPortIds = useMemo(
    () => new Set(pendingAlerts.filter((a) => a.trigger === "BERTH_SLOT_OPPORTUNITY").map((a) => a.port.toLowerCase())),
    [pendingAlerts],
  );
  const incident = useIncidentStore((s) => (selectedIncidentId ? s.incidents[selectedIncidentId] : undefined));
  const decideIncidentSpeed = useIncidentStore((s) => s.decideSpeed);
  const currentSimTime = useSimulationStore((s) => s.currentSimTime);
  const newsTitle = useNewsStore(
    (s) => s.items.find((n) => n.incidentId === selectedIncidentId && n.sourceType === "NEWS")?.title ?? "",
  );
  const navigate = useNavigate();

  const isDraft = decisionStatus === "DRAFT";
  const [activeTab, setActiveTab] = useState<string>("schedule");
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const detailTabsRef = useRef<HTMLDivElement | null>(null);

  const vesselEntries = incident?.provisionalByVessel ?? [];
  const activeVesselEntry = vesselEntries.find((v) => v.vesselId === selectedVesselId) ?? vesselEntries[0] ?? null;

  useEffect(() => {
    if (isDraft && !DRAFT_TAB_IDS.includes(activeTab)) setActiveTab("schedule");
    if (!isDraft && !EXECUTION_TAB_IDS.includes(activeTab)) setActiveTab("progress");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraft]);

  // 승인 완료 토스트를 잠시 보여준 뒤: 같은 사건에 아직 안 정한 선박이 남아있으면 바로 이어서
  // 그 선박의 판단 화면으로 전환하고(대시보드로 안 나감), 전부 끝났을 때만 대시보드로 복귀한다.
  useEffect(() => {
    if (!approvalModalOpen) return;
    const timer = setTimeout(() => {
      closeApprovalModal();
      // 선박이 여러 척인 사건(예: GLOVIS-C/D)은 전부 판단이 끝나야 "판단 대기 사건"에서 내린다 —
      // 한 척만 승인됐다고 사건 전체가 처리된 것처럼 큐에서 사라지면 안 된다.
      const currentIncident = selectedIncidentId ? useIncidentStore.getState().incidents[selectedIncidentId] : undefined;
      const nextUndecidedVessel = currentIncident?.provisionalByVessel.find(
        (v) => currentIncident.decidedSpeedByVessel[v.vesselId] === undefined,
      );

      if (nextUndecidedVessel) {
        useDecisionStore.getState().resetForMode("SLOW_DOWN");
        useWorkflowStore.setState({ selectedVesselId: nextUndecidedVessel.vesselId });
        return;
      }

      // 같은 사건에 뉴스·RTA 두 알림이 생길 수 있으므로 find 대신 filter로 전부 해소한다.
      if (selectedIncidentId) {
        for (const alert of alerts) {
          if (alert.linkedIncidentId === selectedIncidentId) resolveAlert(alert.id);
        }
      }
      navigate("/dashboard");
    }, 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalModalOpen, closeApprovalModal, resolveAlert, selectedIncidentId, navigate]);

  const mapVesselId = (activeVesselEntry?.vesselId.toLowerCase() as string) ?? "glovis-e";
  const mapVessel = VESSELS.find((v) => v.id === mapVesselId) ?? VESSELS.find((v) => v.id === "glovis-e")!;

  const speedOptions = useMemo(
    () => (activeVesselEntry ? adaptIncidentOptionsToSpeedOptions(activeVesselEntry.calculation) : []),
    [activeVesselEntry],
  );

  const recommendedOptionId = pickIncidentRecommendedOptionId(speedOptions);

  // 선박/사건이 바뀌어 옵션 목록이 달라졌는데 현재 선택된 optionId가 새 목록에 없으면 권고안으로 되돌린다.
  useEffect(() => {
    if (decisionStatus !== "DRAFT") return;
    if (!speedOptions.some((o) => o.optionId === selectedOptionId)) selectOption(recommendedOptionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedOptions, decisionStatus]);

  // 검토 대상 선박이 바뀔 때마다(최초 진입 포함) decisionStore의 기존 selectedOptionId를 그대로
  // 재사용하지 않고 이번 선박의 권고안으로 다시 맞춘다 — decisionStore 기본값("C")이 우연히 이번
  // 선박의 옵션 목록에도 존재해 위 안전장치를 통과해버리는 경우를 막기 위함이다.
  const lastSyncedVesselKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeVesselEntry || decisionStatus !== "DRAFT") return;
    const key = activeVesselEntry.vesselId;
    if (lastSyncedVesselKeyRef.current === key) return;
    lastSyncedVesselKeyRef.current = key;
    selectOption(recommendedOptionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVesselEntry?.vesselId, decisionStatus]);

  const selectedOption = speedOptions.find((o) => o.optionId === selectedOptionId) ?? speedOptions[0];
  const recommendedOption = speedOptions.find((o) => o.optionId === recommendedOptionId) ?? speedOptions[0];
  const baselineOption = speedOptions.find((o) => o.optionId === "A") ?? speedOptions[0];
  const baseSpeedKnots = baselineOption?.speedKnots ?? 0;
  const portDelayAssumptionHours = incident?.provisionalDelayHours ?? 0;

  const scheduleSteps = useMemo(
    () => (selectedOption ? buildScheduleDomino(selectedOption, mapVessel.scheduleBufferHours) : []),
    [selectedOption, mapVessel.scheduleBufferHours],
  );

  const executionProgress = useMemo(
    () => calculateExecutionProgress(executionClickCount, baseSpeedKnots, selectedOption?.speedKnots ?? 0),
    [executionClickCount, baseSpeedKnots, selectedOption?.speedKnots],
  );

  const rawSelectedOption = activeVesselEntry && selectedOption ? activeVesselEntry.calculation.options[speedOptions.indexOf(selectedOption)] : null;

  // decisionStore의 승인은 화면 세션(비영속) 상태다 — incidentStore.decideSpeed로도 같은 확정 속도를
  // 기록해야 "운항 판단 비교"(사건의 영속 상태)에도 반영되고, 나중에 RTA가 왔을 때 이 확정 속도를
  // 기준으로 추정치·확정치를 비교할 수 있다.
  const handleConfirmApproval = () => {
    if (!incident || !activeVesselEntry || !selectedOption) return;
    decideIncidentSpeed(incident.incidentId, activeVesselEntry.vesselId, selectedOption.speedKnots, new Date(currentSimTime).toISOString());
    confirmApproval({ incidentId: incident.incidentId, vesselId: activeVesselEntry.vesselId });
  };

  const newEtaLabel = rawSelectedOption ? formatIsoLabel(rawSelectedOption.candidateArrivalIso) : "-";
  const berthEtaLabel = rawSelectedOption ? formatIsoLabel(rawSelectedOption.berthingAtIso) : "-";

  const isDirty = selectedOptionId !== recommendedOptionId;

  const portEvent = incident ? adaptIncidentToPortEvent(incident, newsTitle) : null;
  const affectedVesselCount = vesselEntries.length;
  const vesselName = activeVesselEntry?.vesselName ?? "-";

  if (!incident || !activeVesselEntry || !selectedOption || !portEvent) return null;

  const draftTabs: DetailTab[] = [
    {
      id: "schedule",
      label: "일정 영향",
      content: (
        <ScheduleImpactTab
          eventDelayHours={portDelayAssumptionHours}
          arrivalDelayHours={selectedOption.arrivalDelayHours}
          anchorageWaitingHours={selectedOption.anchorageWaitingHours}
          decisionCausedDelayHours={selectedOption.decisionCausedDelayHours}
          steps={scheduleSteps}
        />
      ),
    },
    { id: "ai", label: "AI 근거", content: <AiEvidenceTab event={portEvent} /> },
  ];

  const executionTabs: DetailTab[] = [
    {
      id: "progress",
      label: "실행 현황",
      content: (
        <ExecutionProgressTab
          captainAcknowledged={executionProgress.captainAcknowledged}
          speedChangeStarted={executionProgress.speedChangeStarted}
          targetReached={executionProgress.targetReached}
          targetSpeedKnots={selectedOption.speedKnots}
        />
      ),
    },
    {
      id: "documents",
      label: "생성 문서",
      content: (
        <DocumentsTab
          captainAcknowledged={executionProgress.captainAcknowledged}
          speedChangeStarted={executionProgress.speedChangeStarted}
          decisionCausedDelayHours={selectedOption.decisionCausedDelayHours}
        />
      ),
    },
    {
      id: "monitoring",
      label: "모니터링",
      content: (
        <MonitoringTab currentSpeedKnots={executionProgress.currentSpeedKnots} targetSpeedKnots={selectedOption.speedKnots} />
      ),
    },
  ];

  return (
    <div className="space-y-4 pb-[88px]">
      <div className="space-y-4">
        {isDraft && (
          <button
            type="button"
            onClick={() => (isDirty ? setBackConfirmOpen(true) : navigate("/decisions"))}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} />
            신호 목록으로
          </button>
        )}

        {vesselEntries.length > 1 && isDraft && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">검토 대상 선박</span>
            {vesselEntries.map((v) => (
              <button
                key={v.vesselId}
                type="button"
                onClick={() => switchVessel(v.vesselId)}
                className={`rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
                  v.vesselId === activeVesselEntry?.vesselId
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v.vesselName}
              </button>
            ))}
          </div>
        )}

        <IncidentRibbon
          event={portEvent}
          affectedVesselCount={affectedVesselCount}
          decisionStatus={decisionStatus}
          onOpenEvidence={() => {
            setActiveTab("ai");
            // 탭 자체는 페이지 맨 아래에 있어 눌러도 화면이 안 바뀐 것처럼 보였다 — 탭으로 스크롤해준다.
            requestAnimationFrame(() => detailTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
        />

        <div className="grid h-[420px] grid-cols-[minmax(480px,0.85fr)_minmax(600px,1.15fr)] items-stretch gap-4">
          <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="relative min-h-0 flex-1">
              <FleetMap
                mode={isDraft ? "DECISION_DRAFT" : "EXECUTING"}
                highlightedVesselId={mapVesselId}
                combinedFleet={combinedFleet}
                activeIncidentPortIds={activeIncidentPortIds}
                activeOpportunityPortIds={activeOpportunityPortIds}
                isApproved={!isDraft}
                vesselACurrentSpeedKnots={executionProgress.currentSpeedKnots}
                vesselATargetSpeedKnots={selectedOption.speedKnots}
                focusedVesselId={null}
                decisionCausedDelayHours={selectedOption.decisionCausedDelayHours}
              />
            </div>
            <div className="shrink-0 border-t border-gray-100 px-3 py-1.5 text-[10px] leading-tight text-gray-500">
              선대 규모는 공개 PCTC 계획자료를 참고했으며, 개별 위치와 항차는 기능 시연용 시뮬레이션 데이터입니다.
            </div>
          </div>
          <div className="flex min-w-0 flex-col">
            {isDraft ? (
              <RecommendationCard
                vesselName={vesselName}
                recommendedOption={recommendedOption}
                selectedOption={selectedOption}
                portDelayAssumptionHours={portDelayAssumptionHours}
                onOpenDetail={() => {
                  setActiveTab("schedule");
                  requestAnimationFrame(() => detailTabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                onApproveRecommended={() => {
                  selectOption(recommendedOption.optionId);
                  openReviewModal();
                }}
              />
            ) : (
              <ExecutionStatusCard
                vesselName={vesselName}
                approvedSpeedKnots={selectedOption.speedKnots}
                baseSpeedKnots={baseSpeedKnots}
                currentSpeedKnots={executionProgress.currentSpeedKnots}
                newEtaLabel={newEtaLabel}
                berthEtaLabel={berthEtaLabel}
                decisionCausedDelayHours={selectedOption.decisionCausedDelayHours}
                captainAcknowledged={executionProgress.captainAcknowledged}
                speedChangeStarted={executionProgress.speedChangeStarted}
                targetReached={executionProgress.targetReached}
              />
            )}
          </div>
        </div>

        <SpeedOptionGrid
          options={speedOptions}
          selectedOptionId={selectedOptionId}
          recommendedOptionId={recommendedOptionId}
          readOnly={!isDraft}
          onSelect={selectOption}
        />

        {isDraft && <DelayChangeRiskWarning option={selectedOption} portDelayAssumptionHours={portDelayAssumptionHours} />}

        {isDraft && (
          <SelectionComparisonRibbon
            selectedOption={selectedOption}
            recommendedOption={recommendedOption}
            baselineOption={baselineOption}
          />
        )}

        <div ref={detailTabsRef}>
          <DetailTabs tabs={isDraft ? draftTabs : executionTabs} activeTabId={activeTab} onChangeTab={setActiveTab} />
        </div>
      </div>

      {isDraft ? (
        <ApprovalBar
          baseSpeedKnots={baseSpeedKnots}
          option={selectedOption}
          isHeld={isHeld}
          onReset={reset}
          onHold={hold}
          onApprove={openReviewModal}
        />
      ) : (
        <ExecutionBar
          option={selectedOption}
          revokeDeadlineAt={revokeDeadlineAt}
          targetReached={executionProgress.targetReached}
          onRevoke={openRevokeConfirm}
          onAdvance={advanceExecution}
        />
      )}

      {reviewModalOpen && (
        <FinalReviewModal
          vesselName={vesselName}
          option={selectedOption}
          recommendedOption={recommendedOption}
          baseSpeedKnots={baseSpeedKnots}
          portDelayAssumptionHours={portDelayAssumptionHours}
          onCancel={cancelReviewModal}
          onConfirm={handleConfirmApproval}
        />
      )}
      {approvalModalOpen && <ApprovalModal title={`${vesselName} 운항 변경안이 승인되었습니다.`} />}
      {revokeConfirmOpen && <RevokeConfirmModal onCancel={cancelRevokeConfirm} onConfirm={confirmRevoke} />}

      {backConfirmOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-700">
              현재 운항 판단 내용이 초기화될 수 있습니다.
              <br />
              신호 목록으로 돌아가시겠습니까?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setBackConfirmOpen(false)}
                className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setBackConfirmOpen(false);
                  navigate("/decisions");
                }}
                className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
