import { normalizeSearchText, searchMatcher } from './text-search';

describe('text search', () => {
  it('ignores diacritics, hamza, ta marbuta and Arabic-Indic digits', () => {
    expect(normalizeSearchText('  الْمُهَنْدِس أحمد ')).toBe('المهندس احمد');
    expect(normalizeSearchText('مدرسة')).toBe(normalizeSearchText('مدرسه'));
    expect(normalizeSearchText('٠٩٣٣')).toBe('0933');
  });

  it('requires every word, in any order, across all fields', () => {
    const match = searchMatcher('احمد حلب');
    expect(match('أحمد الحسن', 'فرع حلب')).toBe(true);
    expect(match('أحمد الحسن', 'فرع دمشق')).toBe(false);
    expect(searchMatcher('حلب احمد')('أحمد الحسن', 'فرع حلب')).toBe(true);
  });

  it('matches everything on an empty query and skips null fields', () => {
    expect(searchMatcher('   ')('x')).toBe(true);
    expect(searchMatcher('a1')(null, undefined, 'A1234567')).toBe(true);
    expect(searchMatcher('zz')(null, undefined, 5)).toBe(false);
  });
});
