/**
 * المحافظات السورية الأربع عشرة — المناطق الثابتة لمواقع توثيق الأجهزة (قرار 2026-10-03: لا جدول مناطق).
 * الرموز والأسماء من public/maps/syria-governorates.geojson نفسه (ونسخته في الباكاند: Application/Common/Governorates).
 * تُستخدم لقوائم التصفية فقط؛ محافظة الموقع يحددها الخادم من إحداثياته.
 */
export interface GovernorateOption { code: string; name: string; }

export const GOVERNORATES: readonly GovernorateOption[] = [
  { code: 'SY01', name: 'دمشق' },
  { code: 'SY02', name: 'حلب' },
  { code: 'SY03', name: 'ريف دمشق' },
  { code: 'SY04', name: 'حمص' },
  { code: 'SY05', name: 'حماة' },
  { code: 'SY06', name: 'اللاذقية' },
  { code: 'SY07', name: 'إدلب' },
  { code: 'SY08', name: 'الحسكة' },
  { code: 'SY09', name: 'دير الزور' },
  { code: 'SY10', name: 'طرطوس' },
  { code: 'SY11', name: 'الرقة' },
  { code: 'SY12', name: 'درعا' },
  { code: 'SY13', name: 'السويداء' },
  { code: 'SY14', name: 'القنيطرة' }
];

export function governorateName(code: string | null | undefined): string {
  return GOVERNORATES.find(g => g.code === code)?.name ?? '';
}
