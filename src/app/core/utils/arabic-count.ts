/**
 * صياغة الأعداد بالعربية مع المعدود: 1 → المفرد + «واحد/ة»، 2 → المثنى، 3–10 → الجمع، 11 فأكثر → المفرد منصوباً.
 * مصدر واحد لكل الشاشات (نموذج الطلب، المراجعة، سجل الموظف، الطباعة).
 */
export function countAr(n: number, forms: { zero: string; one: string; two: string; few: string; many: string }): string {
  if (n === 0) return forms.zero;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  return n >= 3 && n <= 10 ? `${n} ${forms.few}` : `${n} ${forms.many}`;
}

/** 1 → يوم واحد، 2 → يومان، 3–10 → 3 أيام، 11+ → 11 يوماً */
export const daysAr = (n: number) => countAr(n, { zero: 'لا أيام', one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يوماً' });

/** 1 → جمعة واحدة، 2 → جمعتان، 3+ → 3 أيام جمعة */
export const fridaysAr = (n: number) => countAr(n, { zero: 'لا جمعة', one: 'جمعة واحدة', two: 'جمعتان', few: 'أيام جمعة', many: 'يوم جمعة' });

/** 1 → عطلة رسمية واحدة، 2 → عطلتان رسميتان، 3–10 → 3 عطل رسمية */
export const holidaysAr = (n: number) => countAr(n, { zero: 'لا عطل رسمية', one: 'عطلة رسمية واحدة', two: 'عطلتان رسميتان', few: 'عطل رسمية', many: 'عطلة رسمية' });

/** 1 → إجازة واحدة، 2 → إجازتان، 3–10 → 3 إجازات */
export const vacationsAr = (n: number) => countAr(n, { zero: 'لا إجازات', one: 'إجازة واحدة', two: 'إجازتان', few: 'إجازات', many: 'إجازة' });
