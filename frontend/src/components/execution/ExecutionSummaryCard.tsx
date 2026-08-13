import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import type { ExecutionSummary } from "../../types/decision";
import { Badge } from "../common/Badge";
import { formatKnots } from "../../lib/format";
import { useCountdown, REVOKE_WINDOW_REAL_MS, REVOKE_WINDOW_DISPLAY_SCALE } from "../../lib/useCountdown";
import { useIncidentStore } from "../../stores/incidentStore";

/**
 * /decisions 하단 요약 전용 카드. ExecutionStatusCard/ExecutionProgressTab 등 상세 탭 컴포넌트를
 * 그대로 넣지 않고, 명세된 필드만 한 화면에 압축해서 보여준다. 상세 진행률·문서·모니터링은
 * "상세 보기"로 이동한 판단 상세 화면(기존 컴포넌트)에서 확인한다.
 */
export function ExecutionSummaryCard({ summary, onRevoke }: { summary: ExecutionSummary; onRevoke: () => void }) {
  const navigate = useNavigate();
  const isIncidentBacked = useIncidentStore((s) => !!s.incidents[summary.decisionId]);
  const { label: revokeLabel, expired: revokeExpired } = useCountdown(
    summary.revokeDeadlineAt,
    REVOKE_WINDOW_REAL_MS,
    REVOKE_WINDOW_DISPLAY_SCALE,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">{summary.vesselName}</h3>
            <Badge tone={summary.mode === "SLOW_DOWN" ? "blue" : "teal"}>{summary.modeLabel}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {summary.incidentTitle} · {summary.port}
          </p>
        </div>
        <StageBadge stageLabel={summary.stageLabel} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">속도</dt>
          <dd className="font-medium text-gray-800">
            {formatKnots(summary.baseSpeedKnots)} → {formatKnots(summary.targetSpeedKnots)}
            <span className="ml-1 text-xs text-gray-400">(현재 {formatKnots(summary.currentSpeedKnots)})</span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">승인 시각</dt>
          <dd className="font-medium text-gray-800">
            {summary.approvedAt ? new Date(summary.approvedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">현재 ETA</dt>
          <dd className="font-medium text-gray-800">{summary.currentEtaLabel}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">{summary.mode === "SLOW_DOWN" ? "예상 절감액" : "예상 절감/비용"}</dt>
          <dd className="font-bold text-emerald-700">{summary.costLabel}</dd>
        </div>
      </dl>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <ChecklistItem label="선장 확인" done={summary.captainAcknowledged} />
        <ChecklistItem label="실제 속도 반영" done={summary.actualSpeedApplied} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        <div className="text-xs text-gray-400">
          {revokeExpired ? "철회 가능 시간 만료" : `철회 가능 시간 ${revokeLabel}`}
        </div>
        <div className="flex items-center gap-1.5">
          {!revokeExpired && (
            <button
              type="button"
              onClick={onRevoke}
              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              결정 철회
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              navigate(
                isIncidentBacked ? `/decisions/incident/${summary.decisionId}` : `/decisions/${summary.decisionId}`,
                isIncidentBacked ? { state: { vesselId: summary.vesselId } } : undefined,
              )
            }
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            상세 보기
          </button>
        </div>
      </div>
    </div>
  );
}

function StageBadge({ stageLabel }: { stageLabel: ExecutionSummary["stageLabel"] }) {
  const tone = stageLabel === "목표 속도 도달 · 모니터링 중" || stageLabel === "확정 발효" ? "green" : stageLabel === "속도 변경 중" ? "blue" : "yellow";
  return (
    <Badge tone={tone}>
      {stageLabel}
    </Badge>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {done ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-gray-300" />}
      <span className={done ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </span>
  );
}
