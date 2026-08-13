import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NewsAnalysisSchema, type NewsAnalysis } from "./newsAnalysisSchema.js";
import { NEWS_ANALYSIS_SYSTEM_PROMPT, buildNewsAnalysisUserPrompt } from "./newsAnalyzerPrompt.js";
import { KNOWN_PORTS } from "./knownPorts.js";
import { NewsAnalysisError, type NewsAnalyzer, type NewsArticleInput } from "./newsAnalyzer.js";

const MAX_OUTPUT_TOKENS = 4096;

/** client.messages.parse가 필요로 하는 부분만 뽑은 최소 인터페이스 — 테스트에서 mock을 주입하기 쉽게 한다. */
export interface AnthropicMessagesClient {
  messages: {
    parse: Anthropic["messages"]["parse"];
  };
}

/**
 * Claude API 구현체. 우선순위 1(네이티브 JSON Schema 구조화 출력, `output_config.format` +
 * `client.messages.parse()`)을 사용한다 — 설치된 SDK(0.115.x)가 Haiku 4.5를 포함해 이 방식을
 * 지원하므로 강제 tool_choice 경로는 사용하지 않는다.
 */
export class AnthropicNewsAnalyzer implements NewsAnalyzer {
  constructor(
    private readonly client: AnthropicMessagesClient,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async analyze(article: NewsArticleInput): Promise<NewsAnalysis> {
    const userPrompt = buildNewsAnalysisUserPrompt({
      analysisReferenceTime: new Date().toISOString(),
      article: {
        title: article.title,
        content: article.content,
        source: article.source ?? null,
        publishedAt: article.publishedAt,
        sourceTimezone: article.sourceTimezone ?? null,
        language: article.language ?? null,
      },
      knownPorts: KNOWN_PORTS,
    });

    let response;
    try {
      response = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: NEWS_ANALYSIS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          output_config: { format: zodOutputFormat(NewsAnalysisSchema) },
        },
        { timeout: this.timeoutMs },
      );
    } catch (err) {
      throw mapAnthropicError(err);
    }

    if (response.stop_reason === "refusal") {
      throw new NewsAnalysisError("UPSTREAM", "Claude가 안전 정책에 따라 이 요청을 거부했습니다.");
    }

    if (!response.parsed_output) {
      throw new NewsAnalysisError("VALIDATION", "Claude 응답에서 구조화된 분석 결과를 찾을 수 없습니다.");
    }

    // zodOutputFormat.parse()가 이미 NewsAnalysisSchema로 검증한 값이지만, 우리 스키마의 refine
    // 규칙(교차 필드 검증)까지 명시적으로 다시 확인해 "Zod 검증을 통과한 결과만 사용" 원칙을 지킨다.
    const revalidated = NewsAnalysisSchema.safeParse(response.parsed_output);
    if (!revalidated.success) {
      throw new NewsAnalysisError("VALIDATION", "Claude 응답이 검증 규칙을 통과하지 못했습니다.", { cause: revalidated.error });
    }

    return revalidated.data;
  }
}

export function mapAnthropicError(err: unknown): NewsAnalysisError {
  if (err instanceof NewsAnalysisError) return err;
  if (err instanceof Anthropic.RateLimitError) {
    return new NewsAnalysisError("RATE_LIMIT", "Claude API 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.", { cause: err });
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new NewsAnalysisError("TIMEOUT", "Claude API 응답이 제한 시간 내에 도착하지 않았습니다.", { cause: err });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new NewsAnalysisError("TIMEOUT", "Claude API에 연결할 수 없습니다.", { cause: err });
  }
  if (err instanceof Anthropic.APIError) {
    return new NewsAnalysisError("UPSTREAM", "Claude API 요청이 실패했습니다.", { cause: err });
  }
  if (err instanceof Anthropic.AnthropicError) {
    return new NewsAnalysisError("VALIDATION", "Claude 응답을 해석하지 못했습니다.", { cause: err });
  }
  return new NewsAnalysisError("INTERNAL", "뉴스 분석 중 알 수 없는 오류가 발생했습니다.", { cause: err });
}
