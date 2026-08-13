import { Newspaper } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 6): 접수된 뉴스 목록 + AI 처리 상태로 채운다. */
export function NewsPage() {
  return (
    <PageContainer>
      <EmptyState icon={Newspaper} title="뉴스" description="Phase 6에서 구현 예정입니다." />
    </PageContainer>
  );
}
