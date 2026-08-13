import type { LucideIcon } from "lucide-react";

export type KpiTone = "neutral" | "blue" | "amber" | "red" | "teal";

const TONE_CLASSES: Record<KpiTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  teal: "bg-teal-50 text-teal-600",
};

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${
        onClick ? "text-left transition-colors hover:border-gray-300 hover:bg-gray-50" : ""
      }`}
    >
      {Icon && (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-gray-400">{unit}</span>}
        </p>
      </div>
    </Component>
  );
}
