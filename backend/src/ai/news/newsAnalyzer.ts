export type { NewsAnalysis, KnownPort } from "./newsAnalysisSchema.js";
import type { NewsAnalysis } from "./newsAnalysisSchema.js";

export interface NewsArticleInput {
  id?: string;
  title: string;
  content: string;
  source?: string;
  publishedAt: string;
  sourceTimezone?: string;
  language?: string;
}

/**
 * Claude 구현체(AnthropicNewsAnalyzer)에 직접 의존하지 않도록 분리한 인터페이스.
 * 테스트에서는 이 인터페이스를 구현한 fake analyzer로 교체해 실제 API 호출 없이 검증한다.
 */
export interface NewsAnalyzer {
  analyze(article: NewsArticleInput): Promise<NewsAnalysis>;
}

export type NewsAnalysisErrorKind = "RATE_LIMIT" | "TIMEOUT" | "VALIDATION" | "UPSTREAM" | "INTERNAL";

/** 라우트가 HTTP 상태 코드로 매핑할 수 있도록 실패 종류를 구분해 담는 에러. */
export class NewsAnalysisError extends Error {
  readonly kind: NewsAnalysisErrorKind;

  constructor(kind: NewsAnalysisErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NewsAnalysisError";
    this.kind = kind;
  }
}
