/**
 * رقم هاتف سوري — مطابق لـ MaintenanceRules.IsValidPhone في الباكاند (عدّلهما معاً):
 * جوال 09XXXXXXXX، أو أرضي 0 + رمز المحافظة + الرقم (9–10 خانات)، أو بالصيغة الدولية +963 / 00963 بدل الصفر.
 */
const PHONE = /^(?:0|\+963|00963)[1-9]\d{7,8}$/;

/** يحذف الفراغات والشرطات والأقواس */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s\-()]/g, '');
}

/** فارغ = مقبول (الحقل اختياري) */
export function isValidPhone(value: string | null | undefined): boolean {
  const phone = normalizePhone(value);
  return !phone || PHONE.test(phone);
}

/** للعرض: 0933 123 456 */
export function formatPhone(value: string | null | undefined): string {
  const phone = normalizePhone(value);
  return /^09\d{8}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone;
}
