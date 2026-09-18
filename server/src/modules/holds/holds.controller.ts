import type { Request, Response } from "express";
import * as holdsService from "./holds.service.js";
import type { CreateHoldInput } from "./holds.types.js";

export async function createHoldHandler(req: Request, res: Response) {
  const userId = req.user!.id; // authGuard runs before this handler and always sets req.user
  const eventId = req.params.id as string;
  const result = await holdsService.createHold(userId, eventId, req.body as CreateHoldInput);
  res.status(201).json(result);
}
