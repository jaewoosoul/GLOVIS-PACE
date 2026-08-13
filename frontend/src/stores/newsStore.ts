import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NewsAnalysis } from "../types/newsAnalysis";
import type { RtaAnalysis } from "../types/rtaAnalysis";
import type { NoiseFilterReason } from "../data/simulationEvents";

export type NewsProcessingStatus =
  // NEWS
  | "접수됨"
  | "AI 분석 중"
  | "운항 영향 있음"
  | "영향 없음"
  | "정보 부족"
  | "분석 실패"
  // RTA (뉴스 추정치와 비교한 결과)
  | "확정치 일치"
  | "재검토 필요(지연 증가)"
  | "재검토 필요(지연 감소)";

export interface NewsItem {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  source: string;
  publishedAtLabel: string;
  submittedAt: string;
  status: NewsProcessingStatus;
  /** 언론 뉴스(1차 정보, 추정값)와 항만 공식 RTA 통보(확정값)를 명확히 구분한다. */
  sourceType: "NEWS" | "RTA";
  /** NEWS와 RTA가 같은 사건이면 같은 incidentId를 공유한다(incidentStore 키). */
  incidentId?: string;
  relatedPort?: string;
  aiVerdict?: string;
  aiConfidence?: "높음" | "중간" | "낮음";
  linkedAlertId?: string;
  /** Claude 뉴스 분석 API(POST /api/news/analyze)의 검증된 구조화 결과. sourceType이 NEWS일 때만 채워진다. */
  analysis?: NewsAnalysis;
  /** Claude RTA 분석 API(POST /api/rta/analyze)의 검증된 구조화 결과. sourceType이 RTA일 때만 채워진다. */
  rtaAnalysis?: RtaAnalysis;
  /** 분석 요청이 실패했을 때 사용자에게 보여줄 메시지(status가 "분석 실패"일 때만 채워진다). */
  analysisError?: string;
  /** §7 TriageResult.filteredBy — 노이즈 시뮬레이션 이벤트에 미리 담아둔 결정론적 필터 사유. AI의 자유 서술(analysis.exclusionReason)과 별개다. */
  filteredBy?: NoiseFilterReason;
  /** filteredBy에 대응하는 사람이 읽을 수 있는 판정 이유. */
  filterReason?: string;
}

/**
 * 앱 시작 시 비어 있다. 가상 시간 시뮬레이션 이벤트로만 여기 쌓이고,
 * 백엔드의 POST /api/news/analyze 또는 /api/rta/analyze(Claude 기반 분석)를 거쳐 status가 갱신된다.
 * localStorage에 persist해 새로고침해도 시뮬레이션의 executedEventIds와 화면 상태가 어긋나지 않는다.
 */
const PENDING_ANALYSIS_STATUSES: readonly NewsProcessingStatus[] = ["접수됨", "AI 분석 중"];

interface NewsState {
  items: NewsItem[];
  /** 분석까지 끝나 확인한 뉴스 id 목록 — /news 방문 시 markAllViewed로 채워 사이드바 배지를 지운다. */
  viewedIds: string[];
  addNews: (item: NewsItem) => void;
  updateStatus: (id: string, patch: Partial<NewsItem>) => void;
  markAllViewed: () => void;
  reset: () => void;
}

export const useNewsStore = create<NewsState>()(
  persist(
    (set, get) => ({
      items: [],
      viewedIds: [],
      addNews: (item) => set((state) => ({ items: [item, ...state.items] })),
      updateStatus: (id, patch) =>
        set((state) => ({
          items: state.items.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      markAllViewed: () => set({ viewedIds: get().items.map((n) => n.id) }),
      reset: () => set({ items: [], viewedIds: [] }),
    }),
    { name: "portpace-news-items" },
  ),
);

/** 분석이 끝났지만 아직 /news에서 확인하지 않은 "속보" 건수 — 사이드바 뉴스 배지에 쓴다. */
export function selectUnviewedNewsCount(state: NewsState): number {
  return state.items.filter((n) => !PENDING_ANALYSIS_STATUSES.includes(n.status) && !state.viewedIds.includes(n.id)).length;
}
