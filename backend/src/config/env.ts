import { z } from "zod";

export type AppEnv = {
  port: number;
  frontendOrigins: string[];

  /** Claude 뉴스 분석 기능 설정. API 키는 반드시 백엔드에서만 사용하며 프런트엔드로 전달하지 않는다. */
  anthropicApiKey: string | undefined;
  anthropicModel: string | undefined;
  anthropicTimeoutMs: number;
};

const DEFAULT_ANTHROPIC_TIMEOUT_MS = 12000;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const portResult = z.coerce.number().int().positive().safeParse(source.PORT ?? "4000");
  const port = portResult.success ? portResult.data : 4000;

  const frontendOriginRaw = source.FRONTEND_ORIGIN && source.FRONTEND_ORIGIN.trim() !== "" ? source.FRONTEND_ORIGIN : "http://localhost:5173";
  const frontendOrigins = frontendOriginRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const anthropicApiKey = source.ANTHROPIC_API_KEY && source.ANTHROPIC_API_KEY.trim() !== "" ? source.ANTHROPIC_API_KEY.trim() : undefined;
  const anthropicModel = source.ANTHROPIC_MODEL && source.ANTHROPIC_MODEL.trim() !== "" ? source.ANTHROPIC_MODEL.trim() : undefined;

  const timeoutResult = z.coerce.number().int().positive().safeParse(source.ANTHROPIC_TIMEOUT_MS ?? String(DEFAULT_ANTHROPIC_TIMEOUT_MS));
  const anthropicTimeoutMs = timeoutResult.success ? timeoutResult.data : DEFAULT_ANTHROPIC_TIMEOUT_MS;

  return { port, frontendOrigins, anthropicApiKey, anthropicModel, anthropicTimeoutMs };
}
