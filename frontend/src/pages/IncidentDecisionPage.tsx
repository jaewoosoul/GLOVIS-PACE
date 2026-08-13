import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useIncidentStore } from "../stores/incidentStore";
import { useWorkflowStore } from "../stores/workflowStore";
import { useDecisionStore } from "../stores/decisionStore";
import { useExecutionRecordsStore, buildRecordId } from "../stores/executionRecordsStore";
import { SlowdownDecisionPage } from "./SlowdownDecisionPage";
import { PageContainer } from "../components/common/PageContainer";
import { SectionCard } from "../components/common/SectionCard";
import { EmptyState } from "../components/common/EmptyState";
import { IncidentCard } from "../components/incidents/IncidentCard";

/**
 * /decisions/incident/:incidentId — 판단 대기 사건의 "검토"와 운항 판단 비교 목록이 이 페이지를 공유한다.
 * RTA가 아직 없으면(뉴스 추정 단계) 판단 대기 사건과 동일한 지도+상세분석 승인 화면(SlowdownDecisionPage)을
 * 그대로 재사용하고, RTA가 도착한 뒤에는 추정치·확정치를 나란히 비교·재확정하는 IncidentCard로 전환한다.
 */
/** 이미 승인된 선박이면 그 레코드를 그대로 불러오고, 아직 판단 전이면 새 DRAFT로 초기화한다. */
function activateVessel(incidentId: string, vesselId: string) {
  const existingRecord = useExecutionRecordsStore.getState().records[buildRecordId(incidentId, vesselId)];
  if (existingRecord) {
    useDecisionStore.getState().loadRecord(existingRecord);
  } else {
    useDecisionStore.getState().resetForMode("SLOW_DOWN");
  }
  useWorkflowStore.setState({ selectedIncidentId: incidentId, selectedVesselId: vesselId });
}

export function IncidentDecisionPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // "실행 및 모니터링 → 상세 보기"에서만 채워진다 — 어떤 선박을 보여줄지 명시적으로 지정한다.
  const requestedVesselId = (location.state as { vesselId?: string } | null)?.vesselId ?? null;
  const incident = useIncidentStore((s) => (incidentId ? s.incidents[incidentId] : undefined));
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!incident || initializedFor.current === incident.incidentId) return;
    initializedFor.current = incident.incidentId;

    const { selectedIncidentId, selectedVesselId: currentVesselId } = useWorkflowStore.getState();
    const { decisionStatus } = useDecisionStore.getState();

    // "상세 보기"로 특정 선박을 지정해 들어온 경우: 이미 그 선박이 활성 세션이면 그대로 두고,
    // 아니면(다른 선박을 보던 중이었어도) 그 선박으로 전환해서 보여준다 — 승인/모니터링 상태를 그대로 봐야 한다.
    if (requestedVesselId) {
      const alreadyOnRequestedVessel = selectedIncidentId === incident.incidentId && currentVesselId === requestedVesselId;
      if (alreadyOnRequestedVessel) return;
      activateVessel(incident.incidentId, requestedVesselId);
      return;
    }

    // "판단 대기 사건 → 검토"로 들어온 경우: 선박이 여러 척이면 아직 안 정한 선박을 우선 보여준다
    // (한 척만 승인해도 다른 척은 그대로 남아있어야 한다). 이미 그 미정 선박을 DRAFT로 보고 있으면 그대로 둔다.
    const undecidedVessel = incident.provisionalByVessel.find((v) => incident.decidedSpeedByVessel[v.vesselId] === undefined);
    const alreadyOnUndecidedDraft =
      selectedIncidentId === incident.incidentId &&
      decisionStatus === "DRAFT" &&
      !!currentVesselId &&
      incident.decidedSpeedByVessel[currentVesselId] === undefined;
    if (alreadyOnUndecidedDraft) return;

    const targetVesselId = undecidedVessel?.vesselId ?? incident.provisionalByVessel[0]?.vesselId ?? null;
    if (targetVesselId) activateVessel(incident.incidentId, targetVesselId);
  }, [incident, requestedVesselId]);

  if (!incident) {
    return (
      <PageContainer>
        <button
          type="button"
          onClick={() => navigate("/decisions")}
          className="mb-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} />
          운항 판단으로 돌아가기
        </button>
        <SectionCard title="운항 판단">
          <EmptyState title="사건을 찾을 수 없습니다." description="운항 판단 페이지의 목록에서 다시 선택해주세요." />
        </SectionCard>
      </PageContainer>
    );
  }

  // RTA 도착 전이고, 매칭된 자사 선박이 있을 때만 판단 화면(SlowdownDecisionPage)을 쓴다 —
  // 매칭된 선박이 없으면(AI가 지연시간을 못 뽑았거나 목적항이 자사선과 무관) 잘못된 GLOVIS-E
  // 데모 데이터로 대체 표시하지 않고 안내만 보여준다.
  if (!incident.rtaAnalysis) {
    if (incident.provisionalByVessel.length === 0) {
      return (
        <PageContainer>
          <button
            type="button"
            onClick={() => navigate("/decisions")}
            className="mb-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} />
            운항 판단으로 돌아가기
          </button>
          <SectionCard title={`${incident.portName} 사건`}>
            <EmptyState
              title="이 사건에 매칭된 자사 선박이 없습니다."
              description="AI가 지연시간을 추출하지 못했거나 목적항이 자사 선대와 무관한 사건입니다."
            />
          </SectionCard>
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <SlowdownDecisionPage />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => navigate("/decisions")}
        className="mb-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        운항 판단으로 돌아가기
      </button>
      <SectionCard title={`${incident.portName} 사건 상세`} description="뉴스 추정치와 RTA 확정치를 비교하고 속도안을 선택합니다">
        <IncidentCard incident={incident} />
      </SectionCard>
    </PageContainer>
  );
}
