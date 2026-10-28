import { ACTIVE_WINDOW_MS, RENEW_WINDOW_MS, shouldRenew } from './session-renewal';

describe('shouldRenew', () => {
  const now = Date.UTC(2026, 10, 1, 10, 0, 0);
  const min = 60_000;

  it('renews an active user whose token is about to end', () => {
    expect(shouldRenew(now, now + 10 * min, now - 2 * min)).toBe(true);
    expect(shouldRenew(now, now + RENEW_WINDOW_MS, now)).toBe(true);
  });

  it('does not renew while there is plenty of time left', () => {
    expect(shouldRenew(now, now + RENEW_WINDOW_MS + min, now)).toBe(false);
  });

  it('lets an idle user expire instead of keeping the session alive', () => {
    expect(shouldRenew(now, now + 10 * min, now - ACTIVE_WINDOW_MS - min)).toBe(false);
  });

  it('never renews a token that already ended or has no readable expiry', () => {
    expect(shouldRenew(now, now - min, now)).toBe(false);
    expect(shouldRenew(now, now, now)).toBe(false);
    expect(shouldRenew(now, Number.NaN, now)).toBe(false);
  });
});
