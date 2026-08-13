import { useEffect, useState } from "react";

/**
 * 데모용 카운트다운. 실제 30분을 기다리지 않도록 실시간(REAL_MS) 대비
 * 화면에 보이는 시간(DISPLAY_SCALE배)을 압축해서 보여준다.
 */
export const REVOKE_WINDOW_REAL_MS = 30_000; // 실제로는 30초만 대기
export const REVOKE_WINDOW_DISPLAY_SCALE = 60; // 30초 실시간 = 1800초(30분) 표시

export function useCountdown(deadlineAt: number | null, realWindowMs: number, displayScale: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (deadlineAt === null) {
    return { remainingDisplaySeconds: 0, expired: true, label: "00:00" };
  }

  const remainingRealMs = Math.max(0, deadlineAt - now);
  const totalDisplaySeconds = (realWindowMs / 1000) * displayScale;
  const remainingDisplaySeconds = Math.ceil((remainingRealMs / realWindowMs) * totalDisplaySeconds);
  const expired = remainingRealMs <= 0;
  const minutes = Math.floor(remainingDisplaySeconds / 60);
  const seconds = remainingDisplaySeconds % 60;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return { remainingDisplaySeconds, expired, label };
}
