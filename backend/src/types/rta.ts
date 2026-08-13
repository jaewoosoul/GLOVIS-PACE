import type { RtaAnalysis } from "../ai/rta/rtaAnalysisSchema.js";
import type { RtaAnalysisErrorKind } from "../ai/rta/rtaAnalyzer.js";

export interface RtaAnalyzeSuccessResponse {
  status: "ANALYZED";
  analysis: RtaAnalysis;
}

export interface RtaAnalyzeErrorResponse {
  error: {
    message: string;
    kind: RtaAnalysisErrorKind | "BAD_REQUEST";
  };
}
