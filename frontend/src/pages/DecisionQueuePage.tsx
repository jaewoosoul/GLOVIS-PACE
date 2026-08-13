import { ClipboardList } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 9): 판단 대기 사건 목록(alertsStore) + 실행 진행 상태로 채운다. */
export function DecisionQueuePage() {
  return (
    <PageContainer>
      <EmptyState icon={ClipboardList} title="운항 판단" description="Phase 9에서 구현 예정입니다." />
    </PageContainer>
  );
}
