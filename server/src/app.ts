import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./shared/lib/env.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { requestLogger } from "./shared/middleware/requestLogger.js";

export const app = express();

app.use(helmet()); // secure default HTTP headers; CSP default is a no-op since this API serves no HTML

app.use(
  cors({
    origin: env.CLIENT_ORIGIN, // explicit origin, not "*" — required once Authorization headers are involved
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"], // Authorization must be listed or the preflight rejects it
  }),
); // no credentials:true — auth is a Bearer token, not cookies

app.use(requestLogger); // must run before routes/errorHandler so req.id/req.log exist everywhere

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);
