import { useState, type ReactNode } from "react";
import { Loader2, AlertTriangle, FileCheck2 } from "lucide-react";
import type { NewsItem } from "../../stores/newsStore";
import { Badge } from "../common/Badge";

function formatIso(iso: string | null): string {
  if (!iso) return "정보 없음";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function highlightBody(body: string, quote: string | null): ReactNode {
  if (!quote) return body;
  const idx = body.indexOf(quote);
  if (idx === -1) return body;
  return (
    <>
      {body.slice(0, idx)}
      <mark className="rounded bg-blue-200 px-0.5">{quote}</mark>
      {body.slice(idx + quote.length)}
    </>
  );
}

/**
 * 뉴스 페이지의 "AI 분석 결과" 영역에서 RTA(항만 공식 통보) 항목을 표시하는 카드.
 * AiAnalysisPanel(NEWS 전용)과 나란히 쓰이며, "항만 공식 RTA · 확정 통보"라는 표현으로
 * 뉴스의 "언론 뉴스 · AI 추정"과 화면에서 명확히 구분한다.
 */
export function RtaAnalysisPanel({ item }: { item: NewsItem }) {
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  if (item.status === "AI 분석 중") {
    return (
      <div className="rounded-lg border border-blue-200 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Loader2 size={16} className="animate-spin text-blue-500" />
          AI 분석 중
        </div>
        <p className="mt-1 text-xs text-gray-500">RTA 통보의 접안 슬롯 조정 구간을 확인하고 있습니다.</p>
      </div>
    );
  }

  if (item.status === "분석 실패") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} />
          분석 실패
        </div>
        <p className="mt-1 text-xs text-red-600">{item.analysisError ?? "AI 분석 중 오류가 발생했습니다."}</p>
      </div>
    );
  }

  const analysis = item.rtaAnalysis;
  if (!analysis) return null;

  return (
    <div className="rounded-lg border border-blue-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge tone="blue">
            <FileCheck2 size={11} className="mr-0.5 inline" />
            항만 공식 RTA
          </Badge>
          <Badge tone="teal">확정 통보</Badge>
        </div>
        <span className="text-xs text-gray-500">분석 신뢰도 {Math.round(analysis.confidence * 100)}%</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">문서번호</dt>
          <dd className="font-medium text-gray-800">{analysis.referenceNumber ?? "정보 없음"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">발행 시각</dt>
          <dd className="font-medium text-gray-800">{formatIso(analysis.issuedAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">항만</dt>
          <dd className="font-medium text-gray-800">
            {analysis.portCanonicalName ?? analysis.portMentionedName}
            {analysis.portUnLocode && <span className="text-gray-400"> · {analysis.portUnLocode}</span>}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">해제 예상</dt>
          <dd className="font-medium text-gray-800">{formatIso(analysis.expectedClearanceAt)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-gray-700">{analysis.incidentSummary}</p>

      <div className="mt-3">
        <p className="mb-1 text-xs font-medium text-gray-500">접안 슬롯 조정 구간 [기존 배정 ETA 기준]</p>
        <div className="overflow-hidden rounded-md border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">구간</th>
                <th className="px-3 py-1.5 font-medium">확정 지연</th>
              </tr>
            </thead>
            <tbody>
              {analysis.etaBands.map((band, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 text-gray-700">
                    {band.label}
                    {band.isOpenEnded && <span className="ml-1 text-gray-400">(이후)</span>}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-gray-800">
                    {band.adjustmentHours === 0 ? "조정 없음" : `확정 지연 ${band.adjustmentHours}시간`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.evidence.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">판단 근거</p>
          <div className="space-y-1.5">
            {analysis.evidence.map((ev, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedQuote((prev) => (prev === ev.quote ? null : ev.quote))}
                className={`block w-full rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedQuote === ev.quote ? "border-blue-300 bg-blue-100/70" : "border-transparent bg-blue-50 hover:bg-blue-100/50"
                }`}
              >
                &ldquo;{ev.quote}&rdquo;
              </button>
            ))}
          </div>
          <details className="mt-1.5 text-xs text-gray-500">
            <summary className="cursor-pointer select-none text-gray-400 hover:text-gray-600">원문 보기</summary>
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-100 bg-white p-2.5 font-mono leading-relaxed text-gray-600">
              {highlightBody(item.body, selectedQuote)}
            </pre>
          </details>
        </div>
      )}

      {analysis.uncertainties.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-amber-700">추가 확인 필요</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
            {analysis.uncertainties.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
