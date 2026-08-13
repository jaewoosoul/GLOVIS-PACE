import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { RtaAnalysisSchema, type RtaAnalysis } from "./rtaAnalysisSchema.js";
import { RTA_ANALYSIS_SYSTEM_PROMPT, buildRtaAnalysisUserPrompt } from "./rtaAnalyzerPrompt.js";
import { KNOWN_PORTS } from "../news/knownPorts.js";
import { RtaAnalysisError, type RtaAnalyzer, type RtaDocumentInput } from "./rtaAnalyzer.js";
import { mapAnthropicError as mapNewsAnthropicError } from "../news/anthropicNewsAnalyzer.js";
import type { NewsAnalysisError } from "../news/newsAnalyzer.js";

const MAX_OUTPUT_TOKENS = 4096;

/** client.messages.parse가 필요로 하는 부분만 뽑은 최소 인터페이스 — 테스트에서 mock을 주입하기 쉽게 한다. */
export interface AnthropicMessagesClient {
  messages: {
    parse: Anthropic["messages"]["parse"];
  };
}

/** 뉴스 분석기와 동일한 우선순위(네이티브 JSON Schema 구조화 출력)를 사용한다. */
export class AnthropicRtaAnalyzer implements RtaAnalyzer {
  constructor(
    private readonly client: AnthropicMessagesClient,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async analyze(document: RtaDocumentInput): Promise<RtaAnalysis> {
    const userPrompt = buildRtaAnalysisUserPrompt({
      analysisReferenceTime: new Date().toISOString(),
      rtaText: document.text,
      knownPorts: KNOWN_PORTS,
    });

    let response;
    try {
      response = await this.client.messages.parse(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: RTA_ANALYSIS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          output_config: { format: zodOutputFormat(RtaAnalysisSchema) },
        },
        { timeout: this.timeoutMs },
      );
    } catch (err) {
      throw mapRtaAnthropicError(err);
    }

    if (response.stop_reason === "refusal") {
      throw new RtaAnalysisError("UPSTREAM", "Claude가 안전 정책에 따라 이 요청을 거부했습니다.");
    }

    if (!response.parsed_output) {
      throw new RtaAnalysisError("VALIDATION", "Claude 응답에서 구조화된 분석 결과를 찾을 수 없습니다.");
    }

    const revalidated = RtaAnalysisSchema.safeParse(response.parsed_output);
    if (!revalidated.success) {
      throw new RtaAnalysisError("VALIDATION", "Claude 응답이 검증 규칙을 통과하지 못했습니다.", { cause: revalidated.error });
    }

    return revalidated.data;
  }
}

/** newsAnalyzer의 mapAnthropicError와 동일한 SDK 에러 분류 로직을 RtaAnalysisError로 재매핑한다. */
export function mapRtaAnthropicError(err: unknown): RtaAnalysisError {
  if (err instanceof RtaAnalysisError) return err;
  const newsError: NewsAnalysisError = mapNewsAnthropicError(err);
  return new RtaAnalysisError(newsError.kind, newsError.message, { cause: newsError.cause });
}
