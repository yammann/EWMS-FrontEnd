/**
 * تجديد الجلسة تلقائياً (قرار 2026-10-28، مقابل SessionRules في الباكاند): التوكن يعيش ساعتين، وتُجدَّد جلسة المستخدم النشط
 * قبل انتهائها بعشرين دقيقة، أما من توقف عن العمل فتنتهي جلسته كالمعتاد. حدّ الجلسة الأقصى (12 ساعة) يفرضه الخادم فيرجع 401.
 */
export const RENEW_WINDOW_MS = 20 * 60_000;
export const ACTIVE_WINDOW_MS = 20 * 60_000;
export const CHECK_EVERY_MS = 60_000;

/** هل نجدّد الآن؟ قريب من الانتهاء (ولم ينتهِ بعد) والمستخدم تفاعل مع الصفحة خلال النافذة الأخيرة */
export function shouldRenew(nowMs: number, expiresAtMs: number, lastActivityMs: number): boolean {
  if (!Number.isFinite(expiresAtMs)) return false;
  const remaining = expiresAtMs - nowMs;
  return remaining > 0 && remaining <= RENEW_WINDOW_MS && nowMs - lastActivityMs <= ACTIVE_WINDOW_MS;
}
