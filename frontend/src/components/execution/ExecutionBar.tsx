import type { SpeedOptionId } from "../../types/decision";
import { formatKnots, formatOptionId } from "../../lib/format";
import { useCountdown, REVOKE_WINDOW_REAL_MS, REVOKE_WINDOW_DISPLAY_SCALE } from "../../lib/useCountdown";

interface ExecutionBarOption {
  optionId: SpeedOptionId;
  label: string;
  speedKnots: number;
}

export function ExecutionBar({
  option,
  revokeDeadlineAt,
  targetReached,
  onRevoke,
  onAdvance,
}: {
  option: ExecutionBarOption;
  revokeDeadlineAt: number | null;
  targetReached: boolean;
  onRevoke: () => void;
  onAdvance: () => void;
}) {
  const { label, expired } = useCountdown(revokeDeadlineAt, REVOKE_WINDOW_REAL_MS, REVOKE_WINDOW_DISPLAY_SCALE);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-8 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-blue-900">
            승인된 옵션: {formatOptionId(option.optionId)} {option.label} · 목표 {formatKnots(option.speedKnots)}
          </span>
          {!expired && <span className="font-medium text-amber-600">철회 가능 시간 {label}</span>}
        </div>

        <div className="flex items-center gap-2">
          {!expired && (
            <button
              type="button"
              onClick={onRevoke}
              className="rounded-md border border-red-300 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              결정 철회
            </button>
          )}
          {targetReached ? (
            <span className="rounded-md bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              확정 발효 · 모니터링 중
            </span>
          ) : (
            <button
              type="button"
              onClick={onAdvance}
              className="rounded-md bg-blue-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              다음 실행 단계
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
