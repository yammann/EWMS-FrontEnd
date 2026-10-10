/** رسالة الخطأ من رد الـ API (apiErrorInterceptor يوحّدها في message) أو نص بديل */
export function errorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string; error?: { message?: string } } | null;
  return e?.error?.message || e?.message || fallback;
}
