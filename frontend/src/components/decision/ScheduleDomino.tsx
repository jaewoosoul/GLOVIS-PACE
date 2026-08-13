import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import type { ScheduleDominoStep } from "../../types/decision";

const STATUS_STYLE: Record<ScheduleDominoStep["status"], { dot: string; text: string; icon: ReactNode }> = {
  정상: { dot: "bg-emerald-500", text: "text-emerald-700", icon: <CheckCircle2 size={14} /> },
  "협의 필요": { dot: "bg-amber-500", text: "text-amber-700", icon: <HelpCircle size={14} /> },
  지연: { dot: "bg-red-500", text: "text-red-700", icon: <AlertCircle size={14} /> },
  미계산: { dot: "bg-gray-300", text: "text-gray-400", icon: null },
};

export function ScheduleDomino({ steps }: { steps: ScheduleDominoStep[] }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => {
        const style = STATUS_STYLE[step.status];
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
            <span className="w-32 shrink-0 text-sm font-medium text-gray-800">{step.label}</span>
            <span className={`flex items-center gap-1 text-xs font-medium ${style.text}`}>
              {style.icon}
              {step.detail}
            </span>
            {index < steps.length - 1 && <span className="ml-auto text-gray-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
