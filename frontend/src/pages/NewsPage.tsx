import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, AlertTriangle, ArrowRight } from "lucide-react";
import { useNewsStore, selectUnviewedNewsCount, type NewsItem } from "../stores/newsStore";
import { PageContainer } from "../components/common/PageContainer";
import { SectionCard } from "../components/common/SectionCard";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { AiAnalysisPanel } from "../components/signals/AiAnalysisPanel";
import { RtaAnalysisPanel } from "../components/signals/RtaAnalysisPanel";
import type { NoiseFilterReason } from "../data/simulationEvents";

const SOURCE_TYPE_LABEL: Record<NewsItem["sourceType"], string> = { NEWS: "언론 뉴스", RTA: "항만 공식 RTA" };

const FILTERED_BY_LABEL: Record<NoiseFilterReason, string> = {
  PORT_MISMATCH: "항만명 불일치",
  TIME_WINDOW_MISMATCH: "시점 불일치",
  CAUSE_NOT_OPERATIONAL: "사유 유형 무관",
};

/** 이 뉴스가 가리키는 운항 판단 대상 경로 — incidentId가 있으면 실제 선박별 비교 페이지, 없으면(자유 입력) 연결된 판단 신호로. */
function decisionPathFor(item: NewsItem): string | null {
  if (item.incidentId) return `/decisions/incident/${item.incidentId}`;
  if (item.linkedAlertId) return `/decisions/${item.linkedAlertId}`;
  return null;
}

export function NewsPage() {
  const items = useNewsStore((s) => s.items);
  const markAllViewed = useNewsStore((s) => s.markAllViewed);
  const unviewedCount = useNewsStore(selectUnviewedNewsCount);
  const [detailItem, setDetailItem] = useState<NewsItem | null>(null);
  const [analysisItem, setAnalysisItem] = useState<NewsItem | null>(null);
  const navigate = useNavigate();

  // 새 뉴스(속보)가 사이드바 배지로 뜨는 건, 이 페이지를 열어 확인하기 전까지다.
  useEffect(() => {
    if (unviewedCount > 0) markAllViewed();
  }, [unviewedCount, markAllViewed]);

  const newsOnlyItems = items.filter((n) => n.sourceType === "NEWS");
  const rtaOnlyItems = items.filter((n) => n.sourceType === "RTA");
  // "접수됨" 단계는 아직 분석을 시작하지 않은 상태라 제외하고, 분석 중/완료/실패는 모두 보여준다.
  const analyzedItems = items.filter((n) => n.status !== "접수됨");

  return (
    <PageContainer>
      <div className="grid grid-cols-2 gap-4">
        <SectionCard title="뉴스" description="접수된 언론 뉴스(1차 정보·추정치) 목록 — 제목을 클릭하면 상세 내용을 볼 수 있습니다">
          {newsOnlyItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="접수된 뉴스가 없습니다."
              description="사건이 발생하면(시뮬레이션 이벤트) 자동으로 접수되어 여기에 표시됩니다."
            />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {newsOnlyItems.map((item) => (
                <NewsTitleCard key={item.id} item={item} onClick={() => setDetailItem(item)} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="항만뉴스 (RTA)" description="접수된 항만 공식 RTA 통보(확정치) 목록 — 관련 항만을 하이라이트로 표시합니다">
          {rtaOnlyItems.length === 0 ? (
            <EmptyState title="접수된 RTA 통보가 없습니다." description="항만 공식 RTA 통보가 접수되면 여기에 표시됩니다." />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {rtaOnlyItems.map((item) => (
                <PortNewsCard key={item.id} item={item} onClick={() => setDetailItem(item)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="AI 분석결과" description="Claude가 분석한 운항 관련성·사건 정보 — 제목을 클릭하면 분석 결과를 볼 수 있습니다">
          {analyzedItems.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="AI 분석 결과가 없습니다." description="뉴스를 제출하면 분석이 시작되고 결과가 여기에 표시됩니다." />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {analyzedItems.map((item) => (
                <AiAnalysisRow key={item.id} item={item} onClick={() => setAnalysisItem(item)} onOpenDecision={(path) => navigate(path)} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {detailItem && (
        <Modal title={detailItem.title} onClose={() => setDetailItem(null)}>
          {detailItem.subtitle && <p className="mb-3 text-sm font-medium text-gray-500">{detailItem.subtitle}</p>}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{detailItem.body}</p>
          <p className="mt-4 text-xs text-gray-400">
            {detailItem.source} · {detailItem.publishedAtLabel}
          </p>

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="mb-1 text-xs font-semibold text-gray-500">AI 요약</p>
            {detailItem.status === "AI 분석 중" && <p className="text-sm text-gray-500">AI가 분석 중입니다...</p>}
            {detailItem.status === "분석 실패" && (
              <p className="text-sm text-red-600">{detailItem.analysisError ?? "AI 분석 중 오류가 발생했습니다."}</p>
            )}
            {detailItem.analysis && <p className="text-sm leading-relaxed text-gray-700">{detailItem.analysis.summary}</p>}
          </div>
        </Modal>
      )}

      {analysisItem && (
        <Modal title={analysisItem.title} size="lg" onClose={() => setAnalysisItem(null)}>
          {analysisItem.sourceType === "RTA" ? <RtaAnalysisPanel item={analysisItem} /> : <AiAnalysisPanel item={analysisItem} />}
        </Modal>
      )}
    </PageContainer>
  );
}

function NewsTitleCard({ item, onClick }: { item: NewsItem; onClick: () => void }) {
  return (
    <div onClick={onClick} className="cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-gray-800">{item.title}</span>
        <StatusBadge label={item.status} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
        {item.relatedPort && <Badge tone="blue">{item.relatedPort}</Badge>}
        <span>{item.publishedAtLabel}</span>
      </div>
    </div>
  );
}

function PortNewsCard({ item, onClick }: { item: NewsItem; onClick: () => void }) {
  return (
    <div onClick={onClick} className="cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="blue">{item.relatedPort}</Badge>
          <span className="text-sm font-semibold text-gray-800">{item.title}</span>
        </div>
        <StatusBadge label={item.status} />
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {item.source} · {item.publishedAtLabel}
      </p>
    </div>
  );
}

function AiAnalysisRow({
  item,
  onClick,
  onOpenDecision,
}: {
  item: NewsItem;
  onClick: () => void;
  onOpenDecision: (path: string) => void;
}) {
  const decisionPath = decisionPathFor(item);

  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <Badge tone={item.sourceType === "RTA" ? "blue" : "yellow"}>{SOURCE_TYPE_LABEL[item.sourceType]}</Badge>
          <span className="truncate text-sm font-semibold text-gray-800">{item.title}</span>
        </span>
        {item.filteredBy && (
          <span className="truncate text-xs text-gray-400">
            무관 · {FILTERED_BY_LABEL[item.filteredBy]}
            {item.filterReason ? ` · ${item.filterReason}` : ""}
          </span>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge label={item.status} />
        {decisionPath && (
          <button
            type="button"
            onClick={() => onOpenDecision(decisionPath)}
            className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            상세
            <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
