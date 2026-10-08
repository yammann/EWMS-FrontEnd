/**
 * تواريخ النظام (الإنشاء/التعديل/السجل) تُحفظ UTC وتصل بلا منطقة زمنية — نضيف Z ليعرضها المتصفح بالتوقيت المحلي.
 * (تاريخا البدء والإنجاز يسجّلهما الخادم بتوقيته المحلي ويُعرضان كما هما.)
 */
export function utcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
}

/** مبلغ بالليرة السورية بلا كسور زائدة: 12,500 ل.س */
export function money(value: number | null | undefined): string {
  return value == null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ل.س`;
}

/** كمية بخانتين عشريتين على الأكثر */
export function qty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** تاريخ اليوم (أو التاريخ المعطى) المحلي بصيغة yyyy-MM-dd — قيمة حقل date */
export function localDateInput(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
