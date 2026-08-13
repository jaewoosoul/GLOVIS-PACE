export interface Point {
  x: number;
  y: number;
}

/** 폴리라인 위에서 진행률(0~100%)에 해당하는 위치·진행 방향(deg)·현재 위치가 속한 구간 인덱스를 계산한다. */
export function pointAlongPolylineWithSegment(
  points: Point[],
  progressPercent: number,
): Point & { angleDeg: number; segmentIndex: number } {
  if (points.length < 2) {
    const only = points[0] ?? { x: 0, y: 0 };
    return { ...only, angleDeg: 0, segmentIndex: 0 };
  }

  const segmentLengths = points.slice(1).map((p, i) => {
    const prev = points[i];
    return Math.hypot(p.x - prev.x, p.y - prev.y);
  });
  const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);
  const targetLength = (Math.min(100, Math.max(0, progressPercent)) / 100) * totalLength;

  let coveredLength = 0;
  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segmentLength = segmentLengths[i];
    if (coveredLength + segmentLength >= targetLength || i === segmentLengths.length - 1) {
      const start = points[i];
      const end = points[i + 1];
      const ratio = segmentLength === 0 ? 0 : (targetLength - coveredLength) / segmentLength;
      const angleDeg = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
        angleDeg,
        segmentIndex: i,
      };
    }
    coveredLength += segmentLength;
  }

  const last = points[points.length - 1];
  return { ...last, angleDeg: 0, segmentIndex: segmentLengths.length - 1 };
}

/** 타사 선박 진행률(0~100%). 출발 전·도착 후는 null → 지도에서 숨김. */
export function computeOtherVesselProgressPercent(
  departureMs: number,
  arrivalMs: number,
  nowMs: number,
): number | null {
  if (nowMs < departureMs) return null;
  if (nowMs >= arrivalMs) return null;
  return Math.min(100, ((nowMs - departureMs) / (arrivalMs - departureMs)) * 100);
}
