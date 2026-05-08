import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();

vi.mock('../../lib/db.js', () => ({
  dbAdmin: { execute: mockExecute },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    _tag: 'sql',
    text: strings.join('?'),
    values,
  }),
}));

const { getEmailComplianceMetrics } = await import('./complianceService.js');

describe('getEmailComplianceMetrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps row keys to the typed 7d + 30d window shape', async () => {
    mockExecute.mockResolvedValueOnce([
      {
        total_pro_users: 42,
        cadence_active_users: 30,
        unsub_7d: 3, bounce_7d: 1, complaint_7d: 0, sent_7d: 200,
        unsub_30d: 11, bounce_30d: 4, complaint_30d: 1, sent_30d: 800,
      },
    ]);

    const m = await getEmailComplianceMetrics();

    expect(m.totalProUsers).toBe(42);
    expect(m.cadenceActiveUsers).toBe(30);
    expect(m.d7).toEqual({ unsubscribed: 3, bounced: 1, complained: 0, digestsSent: 200 });
    expect(m.d30).toEqual({ unsubscribed: 11, bounced: 4, complained: 1, digestsSent: 800 });
    expect(typeof m.computedAt).toBe('string');
    expect(new Date(m.computedAt).toString()).not.toBe('Invalid Date');
  });

  it('returns zeros across both windows when the result row is empty', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const m = await getEmailComplianceMetrics();

    expect(m.totalProUsers).toBe(0);
    expect(m.cadenceActiveUsers).toBe(0);
    expect(m.d7).toEqual({ unsubscribed: 0, bounced: 0, complained: 0, digestsSent: 0 });
    expect(m.d30).toEqual({ unsubscribed: 0, bounced: 0, complained: 0, digestsSent: 0 });
  });

  it('coerces string-shaped counts (driver may return text from COUNT)', async () => {
    mockExecute.mockResolvedValueOnce([
      {
        total_pro_users: '15', cadence_active_users: '12',
        unsub_7d: '2', bounce_7d: '0', complaint_7d: '1', sent_7d: '100',
        unsub_30d: '5', bounce_30d: '0', complaint_30d: '2', sent_30d: '400',
      },
    ]);

    const m = await getEmailComplianceMetrics();

    expect(m.totalProUsers).toBe(15);
    expect(m.cadenceActiveUsers).toBe(12);
    expect(m.d7.complained).toBe(1);
    expect(m.d30.bounced).toBe(0);
  });

  it('embeds bounce, complaint, and sent event names in the SQL bindings', async () => {
    mockExecute.mockResolvedValueOnce([{}]);

    await getEmailComplianceMetrics();

    const arg = mockExecute.mock.calls[0]![0] as { values: unknown[] };
    expect(arg.values).toContain('email.bounced');
    expect(arg.values).toContain('email.complained');
    expect(arg.values).toContain('digest.sent');
  });

  it('queries both 7-day and 30-day intervals', async () => {
    mockExecute.mockResolvedValueOnce([{}]);

    await getEmailComplianceMetrics();

    const arg = mockExecute.mock.calls[0]![0] as { text: string };
    expect(arg.text).toContain("INTERVAL '7 days'");
    expect(arg.text).toContain("INTERVAL '30 days'");
  });
});
