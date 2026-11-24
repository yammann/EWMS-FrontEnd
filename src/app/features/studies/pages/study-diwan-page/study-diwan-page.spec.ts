import { daysSince } from './study-diwan-page';

describe('daysSince', () => {
  const today = new Date(2026, 10, 24, 9, 30);

  it('counts whole calendar days regardless of the time of day', () => {
    expect(daysSince('2026-11-24T23:10:00', today)).toBe(0);
    expect(daysSince('2026-11-23T23:59:00', today)).toBe(1);
    expect(daysSince('2026-10-25T08:00:00', today)).toBe(30);
  });

  it('never returns a negative wait', () => {
    expect(daysSince('2026-11-30T00:00:00', today)).toBe(0);
  });
});
