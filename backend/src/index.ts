import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadEnv } from "./config/env.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { createNewsAnalysisRoutes } from "./routes/newsAnalysisRoutes.js";
import { createRtaAnalysisRoutes } from "./routes/rtaAnalysisRoutes.js";

const env = loadEnv();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: env.frontendOrigins,
  }),
);

app.use("/api", healthRoutes);
app.use("/api", createNewsAnalysisRoutes(env));
app.use("/api", createRtaAnalysisRoutes(env));

if (!env.anthropicApiKey || !env.anthropicModel) {
  console.warn("[server] ANTHROPIC_API_KEY 또는 ANTHROPIC_MODEL이 설정되지 않았습니다 — /api/news/analyze는 오류를 반환합니다.");
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error", err);
  res.status(500).json({ error: "internal server error" });
});

const server = app.listen(env.port, () => {
  console.log(`[server] listening on :${env.port}`);
});

function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
