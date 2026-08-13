import type { NewsAnalysis } from "../ai/news/newsAnalysisSchema.js";
import type { NewsAnalysisErrorKind } from "../ai/news/newsAnalyzer.js";

export interface NewsAnalyzeSuccessResponse {
  status: "ANALYZED";
  analysis: NewsAnalysis;
}

export interface NewsAnalyzeErrorResponse {
  error: {
    message: string;
    kind: NewsAnalysisErrorKind | "BAD_REQUEST";
  };
}
