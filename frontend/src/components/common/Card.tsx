import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  highlighted = false,
}: {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm ${
        highlighted ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border-b border-gray-100 px-5 py-3 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
