import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Compat: rewrite Vercel serverless paths → existing Express routes ─────────
app.use((req, _res, next) => {
  const base = req.url.split("?")[0];
  const qs   = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  if (req.method === "GET"  && base === "/api/services")           req.url = `/api/smm/services${qs}`;
  else if (req.method === "POST" && base === "/api/order")         req.url = `/api/smm/order${qs}`;
  else if (req.method === "POST" && base === "/api/auth/register") req.url = `/api/auth/supabase-register${qs}`;
  next();
});

app.use("/api", router);

export default app;
