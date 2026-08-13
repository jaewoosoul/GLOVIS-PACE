import { NavLink } from "react-router-dom";
import { LayoutDashboard, Map, Newspaper, ClipboardList, FileBarChart2 } from "lucide-react";
import { useAlertsStore, selectPendingAlerts } from "../../stores/alertsStore";
import { useNewsStore, selectUnviewedNewsCount } from "../../stores/newsStore";

const NAV_ITEMS = [
  { to: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { to: "/map", label: "선대 지도", icon: Map },
  { to: "/news", label: "운항 신호", icon: Newspaper },
  { to: "/decisions", label: "운항 판단", icon: ClipboardList },
  { to: "/reports", label: "리포트", icon: FileBarChart2 },
] as const;

export function Sidebar() {
  const pendingDecisionCount = useAlertsStore((s) => selectPendingAlerts(s).length);
  const unviewedNewsCount = useNewsStore(selectUnviewedNewsCount);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col bg-[#0b1a2e] text-slate-200 print:hidden">
      <div className="flex items-center -ml-4 -mt-2">
        <img src="/glovis-pace-logo.png" alt="Glovis PACE" className="h-28 w-auto object-contain" />
      </div>

      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const badgeCount = to === "/decisions" ? pendingDecisionCount : to === "/news" ? unviewedNewsCount : 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
                  isActive ? "bg-blue-600/90 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={19} />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {badgeCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
