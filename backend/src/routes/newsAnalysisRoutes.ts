import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { AppEnv } from "../config/env.js";
import { AnthropicNewsAnalyzer } from "../ai/news/anthropicNewsAnalyzer.js";
import { validateNewsAnalysis } from "../ai/news/newsAnalysisValidator.js";
import { KNOWN_PORTS } from "../ai/news/knownPorts.js";
import { NewsAnalysisError, type NewsAnalysisErrorKind, type NewsAnalyzer } from "../ai/news/newsAnalyzer.js";
import type { NewsAnalyzeErrorResponse, NewsAnalyzeSuccessResponse } from "../types/news.js";

const MAX_TITLE_LENGTH = 300;
const MAX_CONTENT_LENGTH = 20000;

const NewsArticleRequestSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "title은 비어 있을 수 없습니다.").max(MAX_TITLE_LENGTH),
  content: z.string().trim().min(1, "content는 비어 있을 수 없습니다."),
  source: z.string().optional(),
  publishedAt: z.string().min(1, "publishedAt이 필요합니다."),
  sourceTimezone: z.string().optional(),
  language: z.string().optional(),
});

const ERROR_STATUS: Record<NewsAnalysisErrorKind, number> = {
  RATE_LIMIT: 429,
  TIMEOUT: 504,
  VALIDATION: 502,
  UPSTREAM: 502,
  INTERNAL: 500,
};

/**
 * ANTHROPIC_API_KEY/ANTHROPIC_MODEL이 없으면 분석 요청 시 명확한 오류를 내도록,
 * 이 판단을 라우트 핸들러에서 분리해 단위 테스트로 직접 검증할 수 있게 한다.
 */
export function resolveNewsAnalysisConfig(env: Pick<AppEnv, "anthropicApiKey" | "anthropicModel">): { ok: true } | { ok: false; message: string } {
  if (!env.anthropicApiKey) {
    return { ok: false, message: "ANTHROPIC_API_KEY가 설정되지 않았습니다." };
  }
  if (!env.anthropicModel) {
    return { ok: false, message: "ANTHROPIC_MODEL이 설정되지 않았습니다." };
  }
  return { ok: true };
}

export function createNewsAnalysisRoutes(env: AppEnv, analyzerFactory: (env: AppEnv) => NewsAnalyzer | null = defaultAnalyzerFactory): Router {
  const router = Router();

  router.post("/news/analyze", async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    const parsedBody = NewsArticleRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      const response: NewsAnalyzeErrorResponse = {
        error: { message: "요청 형식이 올바르지 않습니다.", kind: "BAD_REQUEST" },
      };
      res.status(400).json(response);
      return;
    }
    const article = parsedBody.data;

    if (article.content.length > MAX_CONTENT_LENGTH) {
      const response: NewsAnalyzeErrorResponse = {
        error: { message: `본문은 ${MAX_CONTENT_LENGTH}자를 초과할 수 없습니다.`, kind: "BAD_REQUEST" },
      };
      res.status(413).json(response);
      return;
    }

    const configCheck = resolveNewsAnalysisConfig(env);
    if (!configCheck.ok) {
      console.error(`[news-analysis] request=${requestId} config_error="${configCheck.message}"`);
      const response: NewsAnalyzeErrorResponse = { error: { message: configCheck.message, kind: "INTERNAL" } };
      res.status(500).json(response);
      return;
    }

    const analyzer = analyzerFactory(env);
    if (!analyzer) {
      const response: NewsAnalyzeErrorResponse = { error: { message: "뉴스 분석 서비스를 초기화하지 못했습니다.", kind: "INTERNAL" } };
      res.status(500).json(response);
      return;
    }

    try {
      const raw = await analyzer.analyze(article);
      const { analysis, warnings } = validateNewsAnalysis(raw, article, KNOWN_PORTS);
      const durationMs = Date.now() - startedAt;
      console.log(
        `[news-analysis] request=${requestId} news=${article.id ?? "-"} ok duration=${durationMs}ms model=${env.anthropicModel} warnings=${warnings.length}`,
      );
      const response: NewsAnalyzeSuccessResponse = { status: "ANALYZED", analysis };
      res.status(200).json(response);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const analysisError = err instanceof NewsAnalysisError ? err : new NewsAnalysisError("INTERNAL", "알 수 없는 오류가 발생했습니다.", { cause: err });
      console.error(
        `[news-analysis] request=${requestId} news=${article.id ?? "-"} failed=${analysisError.kind} duration=${durationMs}ms model=${env.anthropicModel}`,
      );
      const response: NewsAnalyzeErrorResponse = { error: { message: analysisError.message, kind: analysisError.kind } };
      res.status(ERROR_STATUS[analysisError.kind]).json(response);
    }
  });

  return router;
}

function defaultAnalyzerFactory(env: AppEnv): NewsAnalyzer | null {
  const configCheck = resolveNewsAnalysisConfig(env);
  if (!configCheck.ok) return null;
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  return new AnthropicNewsAnalyzer(client, env.anthropicModel!, env.anthropicTimeoutMs);
}
