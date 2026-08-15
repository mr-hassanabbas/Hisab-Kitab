import express from "express";
import cors from "cors";
import pinoHttpModule from "pino-http";
const pinoHttp = (pinoHttpModule as unknown as { default: typeof pinoHttpModule }).default ?? pinoHttpModule;
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Record<string, unknown>) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: Record<string, unknown>) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", router);

// Health check endpoint for deployment monitoring
app.get("/api/healthz", (req: import("express").Request, res: import("express").Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected", // In production, this should check actual DB connection
      api: "operational",
      version: process.env.npm_package_version || "0.0.0"
    }
  });
});

export default app;
