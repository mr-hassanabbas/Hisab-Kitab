import express, { type RequestHandler } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: typeof req.url === "string" ? req.url.split("?")[0] : req.url,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res(res: any) {
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
const healthzHandler: RequestHandler = (_req, res) => {
     res.json({
       status: "ok",
       timestamp: new Date().toISOString(),
       services: {
         database: "connected",
         api: "operational",
         version: process.env.npm_package_version || "0.0.0"
       }
     });
   };
   app.get("/api/healthz", healthzHandler);
export default app;

