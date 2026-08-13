import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

describe("loadEnv", () => {
  it("defaults to port 4000 when PORT is not set", () => {
    const env = loadEnv(envWith({}));
    expect(env.port).toBe(4000);
  });

  it("parses a custom PORT", () => {
    const env = loadEnv(envWith({ PORT: "8080" }));
    expect(env.port).toBe(8080);
  });

  it("falls back to port 4000 for an invalid PORT", () => {
    const env = loadEnv(envWith({ PORT: "not-a-number" }));
    expect(env.port).toBe(4000);
  });

  it("defaults FRONTEND_ORIGIN to localhost:5173", () => {
    const env = loadEnv(envWith({}));
    expect(env.frontendOrigins).toEqual(["http://localhost:5173"]);
  });

  it("parses a comma-separated FRONTEND_ORIGIN list, trimming whitespace", () => {
    const env = loadEnv(envWith({ FRONTEND_ORIGIN: " http://localhost:5173, https://example.com " }));
    expect(env.frontendOrigins).toEqual(["http://localhost:5173", "https://example.com"]);
  });

  it("leaves anthropicApiKey/anthropicModel undefined when unset", () => {
    const env = loadEnv(envWith({}));
    expect(env.anthropicApiKey).toBeUndefined();
    expect(env.anthropicModel).toBeUndefined();
  });

  it("reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL when set", () => {
    const env = loadEnv(envWith({ ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_MODEL: "claude-haiku-4-5" }));
    expect(env.anthropicApiKey).toBe("sk-ant-test");
    expect(env.anthropicModel).toBe("claude-haiku-4-5");
  });

  it("treats a blank ANTHROPIC_MODEL as unset", () => {
    const env = loadEnv(envWith({ ANTHROPIC_MODEL: "   " }));
    expect(env.anthropicModel).toBeUndefined();
  });

  it("defaults ANTHROPIC_TIMEOUT_MS to 12000", () => {
    const env = loadEnv(envWith({}));
    expect(env.anthropicTimeoutMs).toBe(12000);
  });

  it("parses a custom ANTHROPIC_TIMEOUT_MS", () => {
    const env = loadEnv(envWith({ ANTHROPIC_TIMEOUT_MS: "5000" }));
    expect(env.anthropicTimeoutMs).toBe(5000);
  });

  it("falls back to the default timeout for an invalid ANTHROPIC_TIMEOUT_MS", () => {
    const env = loadEnv(envWith({ ANTHROPIC_TIMEOUT_MS: "not-a-number" }));
    expect(env.anthropicTimeoutMs).toBe(12000);
  });
});
