/**
 * معاملات العنوان: `query({ page: 2, q: '' })` → `?page=2`، ونص فارغ إن لم يبقَ شيء.
 * يُسقط الفارغ دائماً (null / undefined / ''). الصفر يُبقى افتراضياً (قيمة صالحة في بعض التعدادات — مستندات الدراسات)،
 * و`{ dropZero: true }` يُسقطه حيث يعني 0 «الكل» في الفلاتر (الأجهزة والصيانة).
 */
export function query(params: object, options: { dropZero?: boolean } = {}): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '' || (options.dropZero && value === 0)) continue;
    q.set(key, String(value));
  }
  return q.size ? '?' + q : '';
}
