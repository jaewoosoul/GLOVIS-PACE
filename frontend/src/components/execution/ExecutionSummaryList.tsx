import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { useActiveExecutionSummaries } from "../../calculations/executionSelectors";
import { useExecutionRecordsStore } from "../../stores/executionRecordsStore";
import { EmptyState } from "../common/EmptyState";
import { RevokeConfirmModal } from "./RevokeConfirmModal";
import { ExecutionSummaryCard } from "./ExecutionSummaryCard";

/**
 * "판단 대기"와 별개로, 이미 승인되어 실행/모니터링 중인 운항 결정을 모두 요약해서 보여준다.
 * executionRecordsStore가 선박별로 독립된 레코드를 들고 있어, 여러 선박이 동시에 승인돼도
 * 각자의 카드가 그대로 남는다 — 철회도 카드별로 그 레코드만 지운다.
 */
export function ExecutionSummaryList() {
  const summaries = useActiveExecutionSummaries();
  const [revokingRecordId, setRevokingRecordId] = useState<string | null>(null);

  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="현재 실행 중인 운항 결정이 없습니다."
        description="승인된 판단은 이곳에서 모니터링됩니다."
      />
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <ExecutionSummaryCard key={summary.recordId} summary={summary} onRevoke={() => setRevokingRecordId(summary.recordId)} />
      ))}
      {revokingRecordId && (
        <RevokeConfirmModal
          onCancel={() => setRevokingRecordId(null)}
          onConfirm={() => {
            useExecutionRecordsStore.getState().remove(revokingRecordId);
            setRevokingRecordId(null);
          }}
        />
      )}
    </div>
  );
}
