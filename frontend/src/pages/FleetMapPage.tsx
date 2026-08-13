import { Map } from "lucide-react";
import { PageContainer } from "../components/common/PageContainer";
import { EmptyState } from "../components/common/EmptyState";

/** TODO(Phase 4): D3 기반 세계지도 + 97척 시뮬레이션 선대 + GLOVIS A~E 이동으로 채운다. */
export function FleetMapPage() {
  return (
    <PageContainer padded={false}>
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={Map} title="선대 지도" description="Phase 4에서 구현 예정입니다." />
      </div>
    </PageContainer>
  );
}
