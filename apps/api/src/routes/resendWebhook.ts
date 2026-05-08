import { Router, type Request, type Response } from 'express';
import express from 'express';
import { Webhook } from 'svix';
import { ANALYTICS_EVENTS } from 'shared/constants';

import { env } from '../config.js';
import { logger } from '../lib/logger.js';
import { redactRecipient } from '../services/email/providers/console.js';
import { trackEvent, trackEventSystem } from '../services/analytics/trackEvent.js';

export const resendWebhookRouter = Router();

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    tags?: { name: string; value: string }[];
    bounce?: { type?: string; subType?: string; message?: string };
    complaint?: { complaintFeedbackType?: string };
  };
}

function tagValue(tags: { name: string; value: string }[] | undefined, name: string): string | null {
  return tags?.find((t) => t.name === name)?.value ?? null;
}

function parseTagInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstRecipient(to: string | string[] | undefined): string | null {
  if (!to) return null;
  return Array.isArray(to) ? to[0] ?? null : to;
}

function emit(
  eventName: typeof ANALYTICS_EVENTS.EMAIL_BOUNCED | typeof ANALYTICS_EVENTS.EMAIL_COMPLAINED,
  metadata: Record<string, unknown>,
  orgId: number | null,
  userId: number | null,
): void {
  if (orgId !== null && userId !== null) {
    trackEvent(orgId, userId, eventName, metadata);
  } else {
    trackEventSystem(eventName, metadata);
  }
}

resendWebhookRouter.post(
  '/webhooks/resend',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!env.RESEND_WEBHOOK_SECRET) {
      logger.warn('Resend webhook hit but RESEND_WEBHOOK_SECRET is unset, rejecting');
      res.status(400).json({
        error: { code: 'WEBHOOK_NOT_CONFIGURED', message: 'Webhook is not configured for signature verification' },
      });
      return;
    }

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k] = v;
    }

    const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
    let event: ResendEvent;
    try {
      event = wh.verify(req.body.toString('utf8'), headers) as ResendEvent;
    } catch (err) {
      logger.warn({ err }, 'Resend webhook signature verification failed');
      res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } });
      return;
    }

    const data = event.data ?? {};
    const tags = data.tags;
    const orgId = parseTagInt(tagValue(tags, 'org_id'));
    const userId = parseTagInt(tagValue(tags, 'user_id'));
    const template = tagValue(tags, 'template') ?? 'unknown';
    const recipientRaw = firstRecipient(data.to);
    const recipient = recipientRaw ? String(redactRecipient(recipientRaw)) : null;
    const messageId = data.email_id ?? null;

    if (event.type === 'email.bounced') {
      emit(
        ANALYTICS_EVENTS.EMAIL_BOUNCED,
        {
          messageId,
          recipientEmail: recipient,
          template,
          bounceType: data.bounce?.type ?? null,
          bounceSubType: data.bounce?.subType ?? null,
          bouncedAt: event.created_at ?? new Date().toISOString(),
        },
        orgId,
        userId,
      );
      logger.info(
        { provider: 'resend', eventType: event.type, messageId, recipient, template, orgId, userId },
        'Resend bounce event recorded',
      );
    } else if (event.type === 'email.complained') {
      emit(
        ANALYTICS_EVENTS.EMAIL_COMPLAINED,
        {
          messageId,
          recipientEmail: recipient,
          template,
          complaintType: data.complaint?.complaintFeedbackType ?? null,
          complainedAt: event.created_at ?? new Date().toISOString(),
        },
        orgId,
        userId,
      );
      logger.info(
        { provider: 'resend', eventType: event.type, messageId, recipient, template, orgId, userId },
        'Resend complaint event recorded',
      );
    } else {
      logger.debug({ provider: 'resend', eventType: event.type, messageId }, 'Resend event ignored (not bounce/complaint)');
    }

    res.json({ received: true });
  },
);
