import { ClipboardList } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 11): 뉴스 분석 → 4옵션 계산 → 승인 → RTA 확정 판단 화면(SlowdownDecisionPage 재사용)으로 채운다. */
export function IncidentDecisionPage() {
  return (
    <PageContainer>
      <EmptyState icon={ClipboardList} title="운항 판단 상세" description="Phase 11에서 구현 예정입니다." />
    </PageContainer>
  );
}
