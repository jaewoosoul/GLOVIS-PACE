import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "port-pace-backend",
    timestamp: new Date().toISOString(),
  });
});
