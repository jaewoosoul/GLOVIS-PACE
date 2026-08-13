import type { NewsAnalysis, NewsAnalyzeRequestBody } from "../types/newsAnalysis";

/** 백엔드와 동일한 호스트를 쓴다 — API 키는 여기서 절대 다루지 않는다(백엔드에서만 사용). */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export class NewsAnalysisRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NewsAnalysisRequestError";
    this.status = status;
  }
}

export async function analyzeNews(request: NewsAnalyzeRequestBody): Promise<NewsAnalysis> {
  const res = await fetch(`${API_BASE_URL}/api/news/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `뉴스 분석 요청이 실패했습니다. (HTTP ${res.status})`;
    throw new NewsAnalysisRequestError(message, res.status);
  }

  return (body as { analysis: NewsAnalysis }).analysis;
}
