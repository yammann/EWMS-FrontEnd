import { ago, dayLabel } from './notification-time';

/** تاريخ كما يعيده الخادم: UTC بلا «Z» */
const serverTime = (d: Date) => d.toISOString().replace('Z', '');

describe('notification time', () => {
  const now = new Date('2026-11-11T09:00:00Z');
  const before = (minutes: number) => serverTime(new Date(now.getTime() - minutes * 60_000));

  it('reads a timezone-less server date as UTC, whatever the browser offset', () => {
    expect(ago(before(2), now)).toBe('منذ دقيقتين');
    expect(ago(before(0), now)).toBe('الآن');
    expect(ago(before(1), now)).toBe('منذ دقيقة');
    expect(ago(before(5), now)).toBe('منذ 5 دقائق');
    expect(ago(before(45), now)).toBe('منذ 45 دقيقة');
    expect(ago(before(120), now)).toBe('منذ ساعتين');
  });

  it('gives the same result when the date already carries its zone', () => {
    expect(ago(new Date(now.getTime() - 3 * 60_000).toISOString(), now)).toBe('منذ 3 دقائق');
  });

  it('leaves older notifications to the full date', () => {
    expect(ago(before(25 * 60), now)).toBe('');
    expect(ago('not a date', now)).toBe('');
  });

  it('groups by local day', () => {
    expect(dayLabel(before(1), now)).toBe('اليوم');
    expect(dayLabel(before(3 * 24 * 60), now)).toBe('أقدم');
  });
});
