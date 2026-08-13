import type { ReactNode } from "react";

/** 지도처럼 화면을 꽉 채워야 하는 페이지는 padded=false로 사용한다. */
export function PageContainer({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  if (!padded) return <div className="h-full w-full">{children}</div>;
  return <div className="mx-auto max-w-[1440px] px-6 py-5">{children}</div>;
}
