import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { ClipboardList, ChevronRight, ArrowLeftRight } from "lucide-react";
import { useAlertsStore, selectPendingAlerts } from "../stores/alertsStore";
import { useIncidentStore, type Incident } from "../stores/incidentStore";
import { PageContainer } from "../components/common/PageContainer";
import { SectionCard } from "../components/common/SectionCard";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { Badge, type BadgeTone } from "../components/common/Badge";
import { ExecutionSummaryList } from "../components/execution/ExecutionSummaryList";

const INCIDENT_STATUS_LABEL: Record<Incident["status"], string> = {
  NEWS_ONLY: "속도 확정 대기",
  DECIDED: "RTA 대기",
  VERIFIED_UNCHANGED: "추정치와 일치",
  REVIEW_REQUIRED_INCREASED_DELAY: "재검토 필요(지연 증가)",
  REVIEW_REQUIRED_REDUCED_DELAY: "재검토 필요(지연 감소)",
  COMPLETED: "완료된 사건",
};
const INCIDENT_STATUS_TONE: Record<Incident["status"], BadgeTone> = {
  NEWS_ONLY: "yellow",
  DECIDED: "blue",
  VERIFIED_UNCHANGED: "green",
  REVIEW_REQUIRED_INCREASED_DELAY: "red",
  REVIEW_REQUIRED_REDUCED_DELAY: "orange",
  COMPLETED: "green",
};

export function DecisionQueuePage() {
  const navigate = useNavigate();
  const pending = useAlertsStore(useShallow(selectPendingAlerts));
  const incidents = useIncidentStore((s) => s.incidents);
  const incidentList = Object.values(incidents).sort((a, b) => a.incidentId.localeCompare(b.incidentId));

  return (
    <PageContainer>
      <SectionCard title="판단 대기 사건" description="AI 분석 결과 자사선 운항에 영향이 있다고 판정된 사건만 표시합니다">
        {pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="현재 운항 판단이 필요한 사건이 없습니다."
            description="새 뉴스가 분석되어 경보가 생성되면 여기에 나타납니다."
          />
        ) : (
          <div className="max-h-80 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="pb-2 font-medium">위험도</th>
                  <th className="pb-2 font-medium">사건</th>
                  <th className="pb-2 font-medium">항만</th>
                  <th className="pb-2 font-medium">유형</th>
                  <th className="pb-2 font-medium">영향 선박</th>
                  <th className="pb-2 font-medium">AI 신뢰도</th>
                  <th className="pb-2 font-medium">생성 시각</th>
                  <th className="pb-2 font-medium">상태</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((signal) => (
                  <tr key={signal.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5">
                      <StatusBadge label={signal.grade} />
                    </td>
                    <td className="py-2.5 font-medium text-gray-800">{signal.title}</td>
                    <td className="py-2.5 text-gray-600">{signal.port}</td>
                    <td className="py-2.5 text-gray-600">{signal.trigger === "BERTH_SLOT_OPPORTUNITY" ? "증속 검토" : "감속 검토"}</td>
                    <td className="py-2.5 text-gray-600">{signal.affectedVesselCount}척</td>
                    <td className="py-2.5 text-gray-600">{signal.sourceReliability ?? "-"}</td>
                    <td className="py-2.5 text-gray-400">{signal.occurredAtLabel}</td>
                    <td className="py-2.5">
                      <StatusBadge label={signal.processingStatus} tone="blue" />
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/decisions/incident/${signal.linkedIncidentId}`)}
                        className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        검토
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="mt-4">
        <SectionCard title="실행 및 모니터링" description="승인되어 실행 또는 모니터링 중인 운항 결정">
          <div className="max-h-80 overflow-y-auto pr-1">
            <ExecutionSummaryList />
          </div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="운항 판단 비교"
          description="제목을 클릭하면 뉴스 추정치·RTA 확정치 비교와 속도 옵션 카드를 볼 수 있습니다"
        >
          {incidentList.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="비교할 사건이 없습니다."
              description="같은 사건의 뉴스와 RTA가 모두 접수되면 여기서 추정치와 확정치를 비교할 수 있습니다."
            />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {incidentList.map((incident) => (
                <button
                  key={incident.incidentId}
                  type="button"
                  onClick={() => navigate(`/decisions/incident/${incident.incidentId}`)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
                >
                  <span className="text-sm font-semibold text-gray-800">{incident.portName} 사건 — 운항 판단</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={INCIDENT_STATUS_TONE[incident.status]}>{INCIDENT_STATUS_LABEL[incident.status]}</Badge>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
