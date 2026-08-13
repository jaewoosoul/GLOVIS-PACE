import { CheckCircle2, Circle } from "lucide-react";
import { formatKnots } from "../../lib/format";

export function ExecutionProgressTab({
  captainAcknowledged,
  speedChangeStarted,
  targetReached,
  targetSpeedKnots,
}: {
  captainAcknowledged: boolean;
  speedChangeStarted: boolean;
  targetReached: boolean;
  targetSpeedKnots: number;
}) {
  const items = [
    { label: "운항 변경 승인", done: true },
    { label: "선장 지시서 생성", done: true },
    { label: "통보문 생성", done: true },
    { label: "선장 수신 확인", done: captainAcknowledged },
    { label: "속도 변경 시작", done: speedChangeStarted },
    { label: `목표 속도 도달 (${formatKnots(targetSpeedKnots)})`, done: targetReached },
  ];

  return (
    <ol className="max-w-sm space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          {item.done ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : (
            <Circle size={16} className="text-gray-300" />
          )}
          <span className={item.done ? "text-gray-800" : "text-gray-400"}>{item.label}</span>
          <span className={`ml-auto text-xs font-semibold ${item.done ? "text-emerald-600" : "text-gray-400"}`}>
            {item.done ? "완료" : "대기"}
          </span>
        </li>
      ))}
    </ol>
  );
}
