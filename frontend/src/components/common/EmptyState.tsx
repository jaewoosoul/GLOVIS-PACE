import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
      <Icon size={28} className="text-gray-300" />
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {description && <p className="max-w-xs text-xs text-gray-400">{description}</p>}
      {action}
    </div>
  );
}
