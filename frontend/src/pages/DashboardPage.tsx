import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Ship, Navigation, Anchor, ClipboardList, PlayCircle, MapPin } from "lucide-react";
import { useLiveCombinedFleet, selectManagedVesselCount, selectUnderwayVesselCount, selectAnchoredVesselCount, selectActiveExecutionCount } from "../calculations/fleetSelectors";
import { computeFleetStatusSummary } from "../calculations/fleetCalculations";
import { useAlertsStore, selectPendingAlerts } from "../stores/alertsStore";
import { useActiveExecutionSummaries } from "../calculations/executionSelectors";
import { REGION_LABELS } from "../data/regionCorridors";
import type { FleetVessel } from "../types/fleet";
import { PageContainer } from "../components/common/PageContainer";
import { KpiCard } from "../components/common/KpiCard";
import { SectionCard } from "../components/common/SectionCard";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";

export function DashboardPage() {
  const navigate = useNavigate();
  const { fleet, otherFleet } = useLiveCombinedFleet();
  const summary = useMemo(() => computeFleetStatusSummary(fleet), [fleet]);
  const pendingAlerts = useAlertsStore(useShallow(selectPendingAlerts));
  const executionSummaries = useActiveExecutionSummaries();

  const ownRecentMovement = fleet;
  const otherRecentMovement = otherFleet;

  return (
    <PageContainer>
      <div className="mb-4 grid grid-cols-5 gap-3">
        <KpiCard label="관리 선박" value={selectManagedVesselCount(summary)} unit="척" icon={Ship} tone="blue" />
        <KpiCard label="운항 중" value={selectUnderwayVesselCount(summary)} unit="척" icon={Navigation} tone="neutral" />
        <KpiCard label="항만·정박" value={selectAnchoredVesselCount(summary)} unit="척" icon={Anchor} tone="neutral" />
        <KpiCard
          label="운항 판단"
          value={pendingAlerts.length}
          unit="건"
          icon={ClipboardList}
          tone={pendingAlerts.length > 0 ? "red" : "neutral"}
          onClick={() => navigate("/decisions")}
        />
        <KpiCard
          label="실행 중"
          value={selectActiveExecutionCount(summary)}
          unit="척"
          icon={PlayCircle}
          tone="teal"
          onClick={() => navigate("/executions")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="우리 선박" description="자사 선대 기준 최근 갱신 선박">
          {ownRecentMovement.length === 0 ? (
            <EmptyState title="표시할 자사 선박이 없습니다." />
          ) : (
            <VesselMovementTable vessels={ownRecentMovement} onNavigateToMap={(id) => navigate(`/map?vesselId=${id}`)} />
          )}
        </SectionCard>

        <SectionCard title="타사 선박" description="참고용 타사 시뮬레이션 선대 기준">
          {otherRecentMovement.length === 0 ? (
            <EmptyState title="표시할 타사 선박이 없습니다." />
          ) : (
            <VesselMovementTable vessels={otherRecentMovement} onNavigateToMap={(id) => navigate(`/map?vesselId=${id}`)} />
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="최근 운항 결정">
          {executionSummaries.length === 0 ? (
            <EmptyState title="아직 승인된 운항 판단이 없습니다." description="운항 판단을 승인하면 여기에 표시됩니다." />
          ) : (
            <div className="max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[38%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="py-2 pr-3 font-medium">선박명</th>
                    <th className="py-2 pr-3 font-medium">사건</th>
                    <th className="py-2 pr-3 font-medium">승인 시각</th>
                    <th className="py-2 pr-3 font-medium">실행 상태</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {executionSummaries.map((summary) => (
                    <tr key={summary.recordId} className="border-b border-gray-50 last:border-0">
                      <td className="truncate py-2.5 pr-3 font-medium text-gray-800">{summary.vesselName}</td>
                      <td className="truncate py-2.5 pr-3 text-gray-600">{summary.incidentTitle}</td>
                      <td className="truncate py-2.5 pr-3 text-gray-400">
                        {summary.approvedAt ? new Date(summary.approvedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {summary.stageLabel === "확정 발효" ? (
                          <StatusBadge label="완료" tone="green" />
                        ) : (
                          <StatusBadge label="실행 중" tone="blue" />
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate("/executions")}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          실행 현황 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function VesselMovementTable({
  vessels,
  onNavigateToMap,
}: {
  vessels: FleetVessel[];
  onNavigateToMap: (vesselId: string) => void;
}) {
  return (
    <div className="h-[228px] overflow-y-auto pr-2">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[17%]" />
          <col className="w-[9%]" />
          <col className="w-[19%]" />
          <col className="w-[33%]" />
        </colgroup>
        <thead>
          <tr className="sticky top-0 border-b border-gray-100 bg-white text-xs text-gray-400">
            <th className="pb-2 font-medium">선박명</th>
            <th className="pb-2 font-medium">권역</th>
            <th className="pb-2 font-medium">속도</th>
            <th className="pb-2 font-medium">상태</th>
            <th className="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {vessels.map((vessel) => (
            <tr key={vessel.id} className="border-b border-gray-50 last:border-0">
              <td className="truncate py-2.5 font-medium text-gray-800">{vessel.displayName ?? vessel.id}</td>
              <td className="truncate py-2.5 text-gray-600">{REGION_LABELS[vessel.region]}</td>
              <td className="py-2.5 text-gray-600">{vessel.speedKnots.toFixed(1)}kn</td>
              <td className="py-2.5">
                <StatusBadge label={vessel.alertStatus} tone={vessel.alertStatus === "NORMAL" ? "gray" : undefined} />
              </td>
              <td className="whitespace-nowrap py-2.5 pl-5 text-left">
                <button
                  type="button"
                  onClick={() => onNavigateToMap(vessel.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  <MapPin size={12} />
                  지도 보기
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
