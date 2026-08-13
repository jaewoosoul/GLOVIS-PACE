export type { RtaAnalysis } from "./rtaAnalysisSchema.js";
import type { RtaAnalysis } from "./rtaAnalysisSchema.js";

export interface RtaDocumentInput {
  id?: string;
  /** RTA 통보 원문 전체(REF/발신/시각/사건/영향/접안 슬롯 조정 표 등을 모두 포함). */
  text: string;
}

/**
 * Claude 구현체(AnthropicRtaAnalyzer)에 직접 의존하지 않도록 분리한 인터페이스.
 * 테스트에서는 이 인터페이스를 구현한 fake analyzer로 교체해 실제 API 호출 없이 검증한다.
 */
export interface RtaAnalyzer {
  analyze(document: RtaDocumentInput): Promise<RtaAnalysis>;
}

export type RtaAnalysisErrorKind = "RATE_LIMIT" | "TIMEOUT" | "VALIDATION" | "UPSTREAM" | "INTERNAL";

/** 라우트가 HTTP 상태 코드로 매핑할 수 있도록 실패 종류를 구분해 담는 에러. */
export class RtaAnalysisError extends Error {
  readonly kind: RtaAnalysisErrorKind;

  constructor(kind: RtaAnalysisErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RtaAnalysisError";
    this.kind = kind;
  }
}
