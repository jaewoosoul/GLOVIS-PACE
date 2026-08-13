/**
 * 실제 AIS/선장 시스템이 연결되지 않은 상태에서 "다음 실행 단계" 버튼으로
 * 실행 진행을 시연하기 위한 순수 함수. executionClickCount(0~4)에 따라
 * 현재 속도와 체크리스트 완료 여부를 결정한다.
 */
export interface ExecutionProgress {
  captainAcknowledged: boolean;
  speedChangeStarted: boolean;
  targetReached: boolean;
  currentSpeedKnots: number;
}

export function calculateExecutionProgress(
  executionClickCount: number,
  baseSpeedKnots: number,
  targetSpeedKnots: number,
): ExecutionProgress {
  const intermediateSpeedKnots = (baseSpeedKnots + targetSpeedKnots) / 2;

  let currentSpeedKnots = baseSpeedKnots;
  if (executionClickCount >= 4) currentSpeedKnots = targetSpeedKnots;
  else if (executionClickCount === 3) currentSpeedKnots = intermediateSpeedKnots;

  return {
    captainAcknowledged: executionClickCount >= 1,
    speedChangeStarted: executionClickCount >= 2,
    targetReached: executionClickCount >= 4,
    currentSpeedKnots,
  };
}
