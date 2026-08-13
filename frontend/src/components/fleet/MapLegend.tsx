import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ENTRIES: Array<{ swatch: string; label: string; dashed?: boolean; shape?: "circle" | "square" }> = [
  { swatch: "bg-violet-600", label: "자사선 (GLOVIS A~E)" },
  { swatch: "bg-gray-900", label: "타사 선박", dashed: true },
  { swatch: "bg-emerald-600", label: "항구", shape: "square" },
  { swatch: "bg-red-600", label: "항만 사건" },
];

export function MapLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-md border border-gray-200 bg-white/95 text-[11px] shadow">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-4 px-3 py-1.5 font-semibold text-gray-600"
      >
        범례
        {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && (
        <div className="space-y-1 border-t border-gray-100 px-3 py-2">
          {ENTRIES.map((entry) => (
            <div key={entry.label} className="flex items-center gap-1.5 text-gray-600">
              <span
                className={`h-2 w-2 ${entry.shape === "square" ? "" : "rounded-full"} ${entry.swatch} ${entry.dashed ? "ring-1 ring-offset-1 ring-gray-300" : ""}`}
              />
              {entry.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
