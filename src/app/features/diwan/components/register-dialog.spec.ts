import { daysAr } from '@core/utils/arabic-count';

describe('مهلة نوع المعاملة في القائمة', () => {
  it('تُصاغ بالعربية الصحيحة مع العدد', () => {
    expect(daysAr(1)).toBe('يوم واحد');
    expect(daysAr(2)).toBe('يومان');
    expect(daysAr(5)).toBe('5 أيام');
    expect(daysAr(15)).toBe('15 يوماً');
  });
});
