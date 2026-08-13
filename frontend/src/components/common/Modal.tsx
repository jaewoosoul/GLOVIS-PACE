import { X } from "lucide-react";
import type { ReactNode } from "react";

const SIZE_CLASSES = { md: "max-w-xl", lg: "max-w-2xl" } as const;

export function Modal({
  title,
  size = "md",
  onClose,
  children,
}: {
  title: string;
  size?: keyof typeof SIZE_CLASSES;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[85vh] w-full ${SIZE_CLASSES[size]} overflow-y-auto rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
