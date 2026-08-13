import { LayoutDashboard } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 4): KPI·최근 움직임·최근 경보·최근 결정으로 채운다. */
export function DashboardPage() {
  return (
    <PageContainer>
      <EmptyState icon={LayoutDashboard} title="대시보드" description="Phase 4에서 구현 예정입니다." />
    </PageContainer>
  );
}
