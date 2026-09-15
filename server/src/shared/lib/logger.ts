import winston from "winston";
import { env } from "./env.js";

const isProd = env.NODE_ENV === "production";

// Plain JSON in prod — Render's log pipeline parses this; ANSI colors would corrupt it there.
const prodFormat = winston.format.combine(winston.format.timestamp(), winston.format.json());

// Colorized, single-line format for local dev — level/message tinted per level (red/yellow/green/blue)
// so a scrolling console is easy to scan; correlation/meta fields stay as compact JSON alongside.
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const id = requestId ? ` (${requestId})` : "";
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}${id}: ${message}${extra}`;
  }),
);

export const logger = winston.createLogger({
  level: isProd ? "info" : "debug",
  format: isProd ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  ...(isProd ? { defaultMeta: { service: "server" } } : {}), // service tag only useful once logs are aggregated
});
