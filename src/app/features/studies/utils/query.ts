/** معاملات العنوان: يُسقط الفارغ (null / undefined / '') ويُبقي الصفر (قيمة صالحة في بعض التعدادات) */
export function query(params: object): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') q.set(key, String(value));
  }
  return q.size ? '?' + q : '';
}
