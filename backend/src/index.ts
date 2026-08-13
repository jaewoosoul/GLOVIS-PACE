import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadEnv } from "./config/env.js";
import { healthRoutes } from "./routes/healthRoutes.js";

const env = loadEnv();

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: env.frontendOrigins,
  }),
);

app.use("/api", healthRoutes);

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
