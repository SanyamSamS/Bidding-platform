import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "bidding-platform-api" }));

  return app;
}
