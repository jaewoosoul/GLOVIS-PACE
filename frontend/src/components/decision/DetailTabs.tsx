import type { ReactNode } from "react";

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

export function DetailTabs({
  tabs,
  activeTabId,
  onChangeTab,
}: {
  tabs: DetailTab[];
  activeTabId: string;
  onChangeTab: (id: string) => void;
}) {
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex border-b border-gray-100 px-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab.id === activeTab?.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4">{activeTab?.content}</div>
    </div>
  );
}
