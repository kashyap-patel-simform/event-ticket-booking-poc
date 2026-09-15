import express from "express";
import { errorHandler } from "./shared/middleware/errorHandler.js";

export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);
