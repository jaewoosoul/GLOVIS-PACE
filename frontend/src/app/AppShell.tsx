import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { TopHeader } from "../components/layout/TopHeader";
import { SimulationClockBar } from "../components/simulation/SimulationClockBar";

const PAGE_META: Record<string, { title: string }> = {
  "/dashboard": { title: "대시보드" },
  "/map": { title: "선대 지도" },
  "/news": { title: "뉴스" },
  "/decisions": { title: "운항 판단" },
  "/reports": { title: "리포트" },
};

function resolveMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.startsWith("/decisions/")) return { title: "운항 판단 상세" };
  return { title: "GLOVIS PACE" };
}

export function AppShell() {
  const location = useLocation();
  const meta = resolveMeta(location.pathname);
  const isMapPage = location.pathname === "/map";

  return (
    <div className="flex h-screen min-w-[1024px] overflow-hidden bg-gray-100 print:block print:h-auto print:min-w-0 print:overflow-visible print:bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <div className="print:hidden">
          <SimulationClockBar />
          <TopHeader title={meta.title} />
        </div>
        <main
          className={`min-h-0 flex-1 print:h-auto print:overflow-visible ${isMapPage ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
