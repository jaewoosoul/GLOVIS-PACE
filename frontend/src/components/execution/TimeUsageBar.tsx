export function TimeUsageBar({
  portDelayHours,
  arrivalDelayHours,
  anchorageWaitingHours,
  decisionCausedDelayHours,
}: {
  portDelayHours: number;
  arrivalDelayHours: number;
  anchorageWaitingHours: number;
  decisionCausedDelayHours: number;
}) {
  const converted = Math.min(arrivalDelayHours, portDelayHours);
  const total = Math.max(arrivalDelayHours, portDelayHours) || 1;

  const segments = [
    { label: "항해시간으로 전환", hours: converted, color: "bg-blue-500" },
    { label: "항구 앞 대기", hours: anchorageWaitingHours, color: "bg-gray-300" },
    { label: "선택으로 만든 추가 지연", hours: decisionCausedDelayHours, color: "bg-red-500" },
  ].filter((s) => s.hours > 0.05);

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-500">
        {portDelayHours}시간의 항만 지연을 어떻게 사용하는가
      </p>
      <div className="flex h-6 w-full overflow-hidden rounded-md border border-gray-200">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`flex items-center justify-center whitespace-nowrap text-[10px] font-semibold text-white transition-all duration-300 ${s.color}`}
            style={{ width: `${(s.hours / total) * 100}%` }}
            title={`${s.label} ${s.hours.toFixed(1)}h`}
          >
            {(s.hours / total) * 100 > 12 ? `${s.hours.toFixed(0)}h` : ""}
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${s.color}`} />
            {s.label} {s.hours.toFixed(1)}h
          </span>
        ))}
      </div>
    </div>
  );
}
