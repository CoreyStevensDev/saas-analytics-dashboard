import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailCompliancePanel } from './EmailCompliancePanel';
import type { EmailComplianceMetrics } from './types';

const baseMetrics: EmailComplianceMetrics = {
  totalProUsers: 50,
  cadenceActiveUsers: 40,
  d7: { unsubscribed: 1, bounced: 0, complained: 0, digestsSent: 200, opened: 80, clicked: 24 },
  d30: { unsubscribed: 4, bounced: 1, complained: 0, digestsSent: 800, opened: 320, clicked: 96 },
  computedAt: '2026-05-09T12:00:00.000Z',
};

const zeroDenom: EmailComplianceMetrics = {
  totalProUsers: 50,
  cadenceActiveUsers: 0,
  d7: { unsubscribed: 0, bounced: 0, complained: 0, digestsSent: 0, opened: 0, clicked: 0 },
  d30: { unsubscribed: 0, bounced: 0, complained: 0, digestsSent: 0, opened: 0, clicked: 0 },
  computedAt: '2026-05-09T12:00:00.000Z',
};

describe('EmailCompliancePanel engagement cards (AC #7)', () => {
  it('renders Opens + Clicks cards for both windows with formatted rates', () => {
    render(<EmailCompliancePanel metrics={baseMetrics} />);

    expect(screen.getByText('Opens (7d)')).toBeInTheDocument();
    expect(screen.getByText('Opens (30d)')).toBeInTheDocument();
    expect(screen.getByText('Clicks (7d)')).toBeInTheDocument();
    expect(screen.getByText('Clicks (30d)')).toBeInTheDocument();

    // 80/200 = 40%, 24/200 = 12%
    expect(screen.getByText(/40\.00% \(80 of 200\)/)).toBeInTheDocument();
    expect(screen.getByText(/12\.00% \(24 of 200\)/)).toBeInTheDocument();

    // 320/800 = 40%, 96/800 = 12%
    expect(screen.getByText(/40\.00% \(320 of 800\)/)).toBeInTheDocument();
    expect(screen.getByText(/12\.00% \(96 of 800\)/)).toBeInTheDocument();
  });

  it('renders the Apple Mail Privacy Protection caveat copy', () => {
    render(<EmailCompliancePanel metrics={baseMetrics} />);

    const caveat = screen.getByTestId('mpp-caveat');
    expect(caveat).toBeInTheDocument();
    expect(caveat.textContent).toMatch(/Apple Mail Privacy Protection/i);
    expect(caveat.textContent).toMatch(/CTR/);
  });

  it('renders the n/a placeholder for opens / clicks when digestsSent = 0', () => {
    render(<EmailCompliancePanel metrics={zeroDenom} />);

    // formatRate's null path: "n/a (0 of 0)". 5 columns per window * 2 windows
    // = 10 cards; at digestsSent=0 the four sent-denominator cards (bounce,
    // complaint, opens, clicks) all render the placeholder, plus unsubscribes
    // uses cadenceActiveUsers=0 so it also hits the placeholder.
    const placeholderRows = screen.getAllByText(/n\/a \(0 of 0\)/);
    expect(placeholderRows.length).toBeGreaterThanOrEqual(8);
  });
});
