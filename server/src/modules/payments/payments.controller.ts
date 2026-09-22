import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../../shared/lib/env.js";
import { stripe } from "../../shared/lib/stripe.js";
import * as paymentsService from "./payments.service.js";

export async function createCheckoutHandler(req: Request, res: Response) {
  const userId = req.user!.id; // authGuard runs before this handler and always sets req.user
  const holdId = req.params.holdId as string;
  const result = await paymentsService.createCheckoutSession(userId, holdId);
  res.status(201).json(result);
}

export async function listMyBookingsHandler(req: Request, res: Response) {
  const result = await paymentsService.listMyBookings(req.user!.id);
  res.status(200).json(result);
}

// Wired directly in app.ts, not through a normal authGuard'd router — Stripe calls this with no
// user JWT; the trust boundary here is signature verification, not authGuard.
export async function stripeWebhookHandler(req: Request, res: Response) {
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).json({ error: "Missing Stripe-Signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a raw Buffer here (see app.ts's express.raw() for this exact path) — Stripe's
    // signature check needs the untouched bytes, not parsed JSON.
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    req.log.warn("Stripe webhook signature verification failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    res.status(400).json({ error: "Invalid Stripe signature" });
    return;
  }

  const isNewEvent = await paymentsService.recordStripeEvent(event.id, event.type);
  if (!isNewEvent) {
    req.log.info("Duplicate Stripe webhook event ignored", {
      stripeEventId: event.id,
      type: event.type,
    });
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  await paymentsService.processStripeEvent(event, req.log);
  res.status(200).json({ received: true });
}
