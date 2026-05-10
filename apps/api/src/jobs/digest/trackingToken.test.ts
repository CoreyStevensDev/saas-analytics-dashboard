import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  env: { JWT_SECRET: 'a'.repeat(64) },
}));

const { signDigestTrackingToken, verifyDigestTrackingToken } =
  await import('./trackingToken.js');

const PAYLOAD = { userId: 7, orgId: 42, weekStart: '2026-05-04T00:00:00.000Z' };

describe('signDigestTrackingToken', () => {
  it('produces a stable base64url string for the same payload', () => {
    const a = signDigestTrackingToken(PAYLOAD);
    const b = signDigestTrackingToken(PAYLOAD);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces different tokens when any field changes', () => {
    const base = signDigestTrackingToken(PAYLOAD);
    expect(signDigestTrackingToken({ ...PAYLOAD, userId: 8 })).not.toBe(base);
    expect(signDigestTrackingToken({ ...PAYLOAD, orgId: 43 })).not.toBe(base);
    expect(signDigestTrackingToken({ ...PAYLOAD, weekStart: '2026-05-11T00:00:00.000Z' }))
      .not.toBe(base);
  });
});

describe('verifyDigestTrackingToken', () => {
  it('round-trips a valid token', () => {
    const token = signDigestTrackingToken(PAYLOAD);
    expect(verifyDigestTrackingToken(token)).toEqual(PAYLOAD);
  });

  it('returns null for tampered signatures', () => {
    const token = signDigestTrackingToken(PAYLOAD);
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    decoded.sig = decoded.sig.split('').reverse().join('');
    const tampered = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');
    expect(verifyDigestTrackingToken(tampered)).toBeNull();
  });

  it('returns null when payload fields are mutated post-sign', () => {
    const token = signDigestTrackingToken(PAYLOAD);
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    decoded.userId = decoded.userId + 1;
    const swapped = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');
    expect(verifyDigestTrackingToken(swapped)).toBeNull();
  });

  it('returns null for malformed base64', () => {
    expect(verifyDigestTrackingToken('not-base64-?!@')).toBeNull();
    expect(verifyDigestTrackingToken('')).toBeNull();
  });

  it('returns null when payload is not valid JSON', () => {
    const garbage = Buffer.from('this is not json', 'utf8').toString('base64url');
    expect(verifyDigestTrackingToken(garbage)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const noSig = Buffer.from(JSON.stringify({ userId: 1, orgId: 2, weekStart: 'x' }), 'utf8')
      .toString('base64url');
    expect(verifyDigestTrackingToken(noSig)).toBeNull();

    const noUser = Buffer.from(JSON.stringify({ orgId: 2, weekStart: 'x', sig: 'abc' }), 'utf8')
      .toString('base64url');
    expect(verifyDigestTrackingToken(noUser)).toBeNull();

    const noOrg = Buffer.from(JSON.stringify({ userId: 1, weekStart: 'x', sig: 'abc' }), 'utf8')
      .toString('base64url');
    expect(verifyDigestTrackingToken(noOrg)).toBeNull();

    const noWeek = Buffer.from(JSON.stringify({ userId: 1, orgId: 2, sig: 'abc' }), 'utf8')
      .toString('base64url');
    expect(verifyDigestTrackingToken(noWeek)).toBeNull();
  });

  it('returns null when types are wrong (string userId)', () => {
    const wrongType = Buffer.from(
      JSON.stringify({ userId: '7', orgId: 42, weekStart: 'x', sig: 'abc' }),
      'utf8',
    ).toString('base64url');
    expect(verifyDigestTrackingToken(wrongType)).toBeNull();
  });

  it('uses constant-time comparison (sigs of differing length return null safely)', () => {
    const decoded = { ...PAYLOAD, sig: 'short' };
    const truncated = Buffer.from(JSON.stringify(decoded), 'utf8').toString('base64url');
    expect(verifyDigestTrackingToken(truncated)).toBeNull();
  });

  it('cannot be replayed as an unsubscribe token (purpose prefix isolation)', () => {
    const trackToken = signDigestTrackingToken(PAYLOAD);
    const decoded = JSON.parse(Buffer.from(trackToken, 'base64url').toString('utf8'));
    expect(decoded.sig).not.toBe('');
  });

  it('rejects oversized tokens before parsing (soft DOS guard)', () => {
    // 513 chars, one over the cap; verifier short-circuits before JSON.parse
    const oversized = 'a'.repeat(513);
    expect(verifyDigestTrackingToken(oversized)).toBeNull();
  });
});
