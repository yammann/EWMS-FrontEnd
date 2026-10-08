import { localDateInput, money, qty, utcDate } from './format';

describe('format helpers', () => {
  it('utcDate appends Z only when the value has no timezone', () => {
    expect(utcDate('2026-10-08T10:00:00')?.toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(utcDate('2026-10-08T10:00:00+03:00')?.toISOString()).toBe('2026-10-08T07:00:00.000Z');
    expect(utcDate('2026-10-08T10:00:00Z')?.toISOString()).toBe('2026-10-08T10:00:00.000Z');
    expect(utcDate(undefined)).toBeNull();
  });
  it('money and qty keep at most two decimals', () => {
    expect(money(1234.567)).toBe('1,234.57 ل.س');
    expect(money(undefined)).toBe('—');
    expect(qty(3)).toBe('3');
    expect(qty(2.5)).toBe('2.5');
  });
  it('localDateInput uses the local calendar day, zero-padded', () => {
    expect(localDateInput(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
