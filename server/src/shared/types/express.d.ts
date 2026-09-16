import type { Logger } from "winston";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user?: { id: string };
    }
  }
}
