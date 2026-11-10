/**
 * بحث نصي في القوائم المحمّلة في الواجهة: يتجاهل التشكيل والتطويل والهمزات والتاء المربوطة والألف المقصورة وحالة الأحرف،
 * ويحوّل الأرقام الهندية إلى لاتينية. كل كلمات البحث يجب أن تظهر (بأي ترتيب) في أي من الحقول.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** يعيد دالة مطابقة للاستعلام؛ استعلام فارغ يطابق كل شيء */
export function searchMatcher(query: string): (...fields: (string | number | null | undefined)[]) => boolean {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!tokens.length) return () => true;
  return (...fields) => {
    const haystack = normalizeSearchText(fields.map(f => f ?? '').join(' '));
    return tokens.every(t => haystack.includes(t));
  };
}
