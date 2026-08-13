import { Loader2, RotateCcw, SkipForward } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSimulationStore } from "../../stores/simulationStore";
import { SIMULATION_EVENTS } from "../../data/simulationEvents";
import { Badge } from "../common/Badge";

function formatSimTime(ms: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(ms));
}

const KIND_LABEL: Record<string, string> = { NEWS: "뉴스", RTA: "RTA 통보", NOISE: "노이즈", VESSEL: "선박 상태" };
const KIND_TONE: Record<string, "yellow" | "blue" | "gray" | "teal"> = { NEWS: "yellow", RTA: "blue", NOISE: "gray", VESSEL: "teal" };

export function SimulationClockBar() {
  const navigate = useNavigate();
  const currentSimTime = useSimulationStore((s) => s.currentSimTime);
  const executedEventIds = useSimulationStore((s) => s.executedEventIds);
  const activeEventId = useSimulationStore((s) => s.activeEventId);
  const isProcessingEvent = useSimulationStore((s) => s.isProcessingEvent);
  const eventLog = useSimulationStore((s) => s.eventLog);
  const reset = useSimulationStore((s) => s.reset);
  const triggerNextEvent = useSimulationStore((s) => s.triggerNextEvent);

  const activeEvent = activeEventId ? SIMULATION_EVENTS.find((e) => e.eventId === activeEventId) : null;
  const hasUpcoming = SIMULATION_EVENTS.some((e) => !executedEventIds.includes(e.eventId));

  return (
    <div className="relative border-b border-gray-200 bg-slate-900 px-8 py-2.5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">시뮬레이션 시각</span>
          <span className="font-mono text-sm font-semibold tabular-nums">{formatSimTime(currentSimTime)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void triggerNextEvent()}
            disabled={!hasUpcoming || isProcessingEvent}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isProcessingEvent ? <Loader2 size={13} className="animate-spin" /> : <SkipForward size={13} />}
            {isProcessingEvent ? "AI 분석 중..." : "다음 이벤트"}
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            <RotateCcw size={13} />
            초기화
          </button>
        </div>
      </div>

      {activeEvent && (
        <button
          type="button"
          onClick={() => navigate("/news")}
          className="mt-2 flex w-full flex-wrap items-center gap-3 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-left hover:bg-amber-500/20"
        >
          <div className="flex items-center gap-2 text-xs">
            <Badge tone={KIND_TONE[activeEvent.sourceType]}>{KIND_LABEL[activeEvent.sourceType]}</Badge>
            <span className="font-medium text-amber-100">{activeEvent.label}</span>
            {!isProcessingEvent && <span className="text-amber-200/70">클릭하면 뉴스 화면으로 이동합니다.</span>}
          </div>
        </button>
      )}

      {eventLog.length > 0 && (
        <details className="mt-1.5 text-xs text-slate-400">
          <summary className="cursor-pointer select-none hover:text-slate-200">이벤트 로그 ({eventLog.length})</summary>
          {/* absolute로 띄워 아래 지도 컨테이너 크기에 영향을 주지 않도록 한다 */}
          <ul className="absolute left-0 right-0 z-50 mt-1 max-h-48 space-y-0.5 overflow-y-auto bg-slate-900 px-8 pb-2 pr-9 shadow-lg">
            {eventLog.map((entry) => (
              <li key={`${entry.eventId}-${entry.atMs}`} className="flex items-center gap-2">
                <span className="font-mono">{formatSimTime(entry.atMs)}</span>
                <Badge tone={KIND_TONE[entry.sourceType]}>{KIND_LABEL[entry.sourceType]}</Badge>
                <span>{entry.label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
