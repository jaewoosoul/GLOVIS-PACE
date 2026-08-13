import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { AppEnv } from "../config/env.js";
import { AnthropicRtaAnalyzer } from "../ai/rta/anthropicRtaAnalyzer.js";
import { validateRtaAnalysis } from "../ai/rta/rtaAnalysisValidator.js";
import { KNOWN_PORTS } from "../ai/news/knownPorts.js";
import { RtaAnalysisError, type RtaAnalysisErrorKind, type RtaAnalyzer } from "../ai/rta/rtaAnalyzer.js";
import type { RtaAnalyzeErrorResponse, RtaAnalyzeSuccessResponse } from "../types/rta.js";

const MAX_TEXT_LENGTH = 20000;

const RtaDocumentRequestSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "text는 비어 있을 수 없습니다."),
});

const ERROR_STATUS: Record<RtaAnalysisErrorKind, number> = {
  RATE_LIMIT: 429,
  TIMEOUT: 504,
  VALIDATION: 502,
  UPSTREAM: 502,
  INTERNAL: 500,
};

/** 뉴스 분석과 동일한 API 키/모델 설정을 그대로 재사용한다(별도 RTA 전용 키는 두지 않는다). */
export function resolveRtaAnalysisConfig(env: Pick<AppEnv, "anthropicApiKey" | "anthropicModel">): { ok: true } | { ok: false; message: string } {
  if (!env.anthropicApiKey) {
    return { ok: false, message: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }
  if (!env.anthropicModel) {
    return { ok: false, message: "ANTHROPIC_MODEL이 설정되지 않았습니다." };
  }
  return { ok: true };
}

export function createRtaAnalysisRoutes(env: AppEnv, analyzerFactory: (env: AppEnv) => RtaAnalyzer | null = defaultAnalyzerFactory): Router {
  const router = Router();

  router.post("/rta/analyze", async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    const parsedBody = RtaDocumentRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const response: RtaAnalyzeErrorResponse = {
        error: { message: "요청 형식이 올바르지 않습니다.", kind: "BAD_REQUEST" },
      };
      res.status(400).json(response);
      return;
    }
    const document = parsedBody.data;

    if (document.text.length > MAX_TEXT_LENGTH) {
      const response: RtaAnalyzeErrorResponse = {
        error: { message: `본문은 ${MAX_TEXT_LENGTH}자를 초과할 수 없습니다.`, kind: "BAD_REQUEST" },
      };
      res.status(413).json(response);
      return;
    }

    const configCheck = resolveRtaAnalysisConfig(env);
    if (!configCheck.ok) {
      console.error(`[rta-analysis] request=${requestId} config_error="${configCheck.message}"`);
      const response: RtaAnalyzeErrorResponse = { error: { message: configCheck.message, kind: "INTERNAL" } };
      res.status(500).json(response);
      return;
    }

    const analyzer = analyzerFactory(env);
    if (!analyzer) {
      const response: RtaAnalyzeErrorResponse = { error: { message: "RTA 분석 서비스를 초기화하지 못했습니다.", kind: "INTERNAL" } };
      res.status(500).json(response);
      return;
    }

    try {
      const raw = await analyzer.analyze(document);
      const { analysis, warnings } = validateRtaAnalysis(raw, document.text, KNOWN_PORTS);
      const durationMs = Date.now() - startedAt;
      console.log(
        `[rta-analysis] request=${requestId} rta=${document.id ?? "-"} ok duration=${durationMs}ms model=${env.anthropicModel} warnings=${warnings.length}`,
      );
      const response: RtaAnalyzeSuccessResponse = { status: "ANALYZED", analysis };
      res.status(200).json(response);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const analysisError = err instanceof RtaAnalysisError ? err : new RtaAnalysisError("INTERNAL", "알 수 없는 오류가 발생했습니다.", { cause: err });
      console.error(
        `[rta-analysis] request=${requestId} rta=${document.id ?? "-"} failed=${analysisError.kind} duration=${durationMs}ms model=${env.anthropicModel}`,
      );
      const response: RtaAnalyzeErrorResponse = { error: { message: analysisError.message, kind: analysisError.kind } };
      res.status(ERROR_STATUS[analysisError.kind]).json(response);
    }
  });

  return router;
}

function defaultAnalyzerFactory(env: AppEnv): RtaAnalyzer | null {
  const configCheck = resolveRtaAnalysisConfig(env);
  if (!configCheck.ok) return null;
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  return new AnthropicRtaAnalyzer(client, env.anthropicModel!, env.anthropicTimeoutMs);
}
