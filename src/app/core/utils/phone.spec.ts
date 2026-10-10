import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';

describe('phone', () => {
  it('accepts Syrian mobile, landline and international forms', () => {
    for (const ok of ['', '0933123456', '0933 123 456', '0933-123-456', '+963933123456', '00963933123456', '0112345678', '031234567'])
      expect(isValidPhone(ok)).toBe(true);
  });

  it('rejects too long, too short and non-numeric values', () => {
    for (const bad of ['093333333333333', '09331234', '933123456', '0933abc456', '0033123456', '+1933123456'])
      expect(isValidPhone(bad)).toBe(false);
  });

  it('normalizes and formats', () => {
    expect(normalizePhone(' 0933-123 (456) ')).toBe('0933123456');
    expect(formatPhone('0933123456')).toBe('0933 123 456');
    expect(formatPhone('0112345678')).toBe('0112345678');
  });
});
