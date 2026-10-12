import { ReportCell, ReportColumn, ReportColumnType, ReportFilter, ReportOption, ReportValues } from '../data-access/report.models';

/** نص الخلية حسب نوع العمود (المعاينة والطباعة) — Excel ينسّقها الخادم */
export function formatCell(value: ReportCell, type: ReportColumnType): string {
  if (value === null || value === undefined || value === '') return '';
  switch (type) {
    case 'date': return String(value).slice(0, 10);
    case 'datetime': return String(value).slice(0, 16).replace('T', ' ');
    case 'number':
    case 'money': return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    case 'decimal': return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
    default: return String(value);
  }
}

export const isNumeric = (type: ReportColumnType) => type === 'number' || type === 'decimal' || type === 'money';

/** مجموع عمود (سطر «المجموع») */
export function columnTotal(rows: ReportCell[][], index: number): number {
  return rows.reduce((sum, row) => sum + (typeof row[index] === 'number' ? row[index] as number : 0), 0);
}

/** خيارات الفلتر الظاهرة: إن كان له أب مختار، ما يتبعه فقط */
export function visibleOptions(filter: ReportFilter, values: ReportValues): ReportOption[] {
  const parent = filter.dependsOn ? values[filter.dependsOn] : '';
  return parent ? filter.options.filter(o => !o.parent || o.parent === parent) : filter.options;
}

/** القيم الافتراضية من تعريف التقرير */
export function initialValues(filters: ReportFilter[]): ReportValues {
  const values: ReportValues = {};
  for (const f of filters) if (f.default) values[f.key] = f.default;
  return values;
}

/**
 * يغيّر قيمة فلتر ويمسح قيم الفلاتر التابعة التي لم تعد ضمن خيارات الأب الجديد (القسم بعد تغيير الفرع مثلاً).
 */
export function setFilterValue(filters: ReportFilter[], values: ReportValues, key: string, value: string): ReportValues {
  const next = { ...values };
  if (value) next[key] = value; else delete next[key];
  for (const f of filters) {
    if (f.dependsOn !== key || !next[f.key]) continue;
    if (!visibleOptions(f, next).some(o => o.value === next[f.key])) delete next[f.key];
  }
  return next;
}

/** الفلاتر المطلوبة التي لم تُملأ */
export const missingRequired = (filters: ReportFilter[], values: ReportValues) => filters.filter(f => f.required && !values[f.key]);

/** أعمدة النسخة المطبوعة */
export const printColumns = (columns: ReportColumn[]) => columns.map((column, index) => ({ column, index })).filter(c => c.column.print);
