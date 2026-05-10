import { Router, type Response } from 'express';

import { requireUser } from '../lib/requireUser.js';
import { withUserRlsContext } from '../lib/rls.js';
import { digestPreferencesQueries } from '../db/queries/index.js';

export const digestRouter = Router();

// GET /digest/last-sent
//
// Read-only operational signal for the dashboard's "Last digest sent ..."
// indicator. Sibling to /preferences/email/digest (write surface for cadence +
// timezone), keeping read-only and write namespaces split. Future read-only
// digest data (history, stats) lands under /digest/...; preference writes stay
// under /preferences/...
digestRouter.get('/last-sent', async (req, res: Response) => {
  const user = requireUser(req);
  const userId = Number(user.sub);

  const prefs = await withUserRlsContext(userId, user.isAdmin, async (tx) =>
    digestPreferencesQueries.getByUserId(userId, tx),
  );

  res.json({
    data: {
      lastSentAt: prefs?.lastSentAt?.toISOString() ?? null,
    },
  });
});
