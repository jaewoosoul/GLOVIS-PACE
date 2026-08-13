import { useEffect, useMemo, useRef, useState } from "react";
import { FileBarChart2, FileDown, Loader2 } from "lucide-react";
import { useReportStore } from "../stores/reportStore";
import { PageContainer } from "../components/common/PageContainer";
import { SectionCard } from "../components/common/SectionCard";
import { EmptyState } from "../components/common/EmptyState";
import { Badge } from "../components/common/Badge";
import { DecisionPdfTemplate } from "../components/report/DecisionPdfTemplate";
import { exportElementToPdf } from "../lib/pdfExport";
import type { CompletedDecisionRecord } from "../types/report";

function formatCompletedAt(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function ReportPage() {
  const records = useReportStore((s) => s.records);
  const sorted = useMemo(() => [...records].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [records]);

  const [pdfRecord, setPdfRecord] = useState<CompletedDecisionRecord | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  // pdfRecord가 바뀌어 숨김 템플릿이 그려진 다음 프레임에 캡처한다 — 같은 렌더에서 바로 캡처하면
  // DOM이 아직 갱신되기 전이라 이전 레코드(또는 빈 화면)를 찍어버릴 수 있다.
  useEffect(() => {
    if (!pdfRecord) return;
    const container = pdfContainerRef.current;
    if (!container) return;

    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (cancelled) return;
        try {
          await exportElementToPdf(container, `운항판단보고서_${pdfRecord.vesselName}_${formatCompletedAt(pdfRecord.completedAt)}.pdf`);
          if (!cancelled) setPdfError(null);
        } catch (err) {
          console.error("[ReportPage] PDF 생성 실패", err);
          if (!cancelled) setPdfError("PDF 생성에 실패했습니다. 다시 시도해 주세요.");
        } finally {
          if (!cancelled) {
            setGeneratingId(null);
            setPdfRecord(null);
          }
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pdfRecord]);

  const handleGeneratePdf = (record: CompletedDecisionRecord) => {
    if (generatingId) return;
    setPdfError(null);
    setGeneratingId(record.id);
    setPdfRecord(record);
  };

  if (records.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={FileBarChart2}
          title="완료된 운항 판단이 아직 없습니다."
          description="운항 판단을 승인하고 실행이 완료되면 여기에 모입니다."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {pdfError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pdfError}</div>
      )}
      <SectionCard title="완료된 사건" description="사건을 선택해 PDF 보고서를 내려받을 수 있습니다">
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {sorted.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3.5 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-bold text-gray-900">
                    {record.vesselName} · {record.incidentTitle}
                  </h3>
                  <Badge tone={record.mode === "SLOW_DOWN" ? "blue" : "teal"}>{record.modeLabel}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {record.port} · 완료 {formatCompletedAt(record.completedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGeneratePdf(record)}
                disabled={generatingId !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {generatingId === record.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    PDF 생성
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 화면 밖에서만 렌더링되는 캡처용 템플릿 — 사용자에게는 보이지 않는다. */}
      <div className="pointer-events-none fixed left-[-9999px] top-0" aria-hidden="true">
        <div ref={pdfContainerRef}>{pdfRecord && <DecisionPdfTemplate record={pdfRecord} />}</div>
      </div>
    </PageContainer>
  );
}
