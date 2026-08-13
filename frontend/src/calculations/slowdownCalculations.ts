import type { SpeedOptionResult, ScheduleDominoStep } from "../types/decision";

const STEP_LABELS = [
  "목적항 도착",
  "접안",
  "하역",
  "목적항 출항",
  "다음 기항지 도착",
  "완성차 인도",
  "다음 항차",
] as const;

/**
 * 선택한 옵션에 따라 일정 도미노 상태를 계산한다.
 * decisionCausedDelayHours(선택으로 인한 추가 지연)가 0이면 접안 이후 전 구간이 "정상"이다.
 */
export function buildScheduleDomino(
  option: SpeedOptionResult,
  scheduleBufferHours: number,
): ScheduleDominoStep[] {
  const delayed = option.decisionCausedDelayHours > 0;
  const remainingBufferHours = Math.max(0, scheduleBufferHours - option.decisionCausedDelayHours);

  const arrivalDetail =
    option.arrivalDelayHours > 0
      ? `+${option.arrivalDelayHours.toFixed(0)}h (기존 대비)`
      : "변동 없음";

  return STEP_LABELS.map((label, index) => {
    if (index === 0) {
      return { key: "arrival", label, status: "정상" as const, detail: arrivalDetail };
    }
    if (index === STEP_LABELS.length - 2) {
      // 완성차 인도: 잔여 여유시간을 표시
      return {
        key: "delivery",
        label,
        status: delayed ? ("협의 필요" as const) : ("정상" as const),
        detail: `여유 ${remainingBufferHours.toFixed(1)}h`,
      };
    }
    return {
      key: label,
      label,
      status: delayed ? ("지연" as const) : ("정상" as const),
      detail: delayed ? `약 ${option.decisionCausedDelayHours.toFixed(0)}h 지연` : "변동 없음",
    };
  });
}
