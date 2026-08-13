import { FileBarChart2 } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 15): 완료된 판단 이력 목록 + 3페이지 PDF 내보내기로 채운다. */
export function ReportPage() {
  return (
    <PageContainer>
      <EmptyState icon={FileBarChart2} title="리포트" description="Phase 15에서 구현 예정입니다." />
    </PageContainer>
  );
}
