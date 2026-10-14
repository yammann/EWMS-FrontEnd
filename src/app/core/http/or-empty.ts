import { OperatorFunction, catchError, of } from 'rxjs';

/**
 * قائمة مساعدة في صفحة (أقسام، مكاتب، أدوار… لخيارات النموذج): فشلها — غالباً لنقص صلاحية عرضها — لا يوقف تحميل
 * الصفحة، بل تُرجع قائمة فارغة وتُبلغ onMissing فتقول الصفحة في النموذج ما الذي ينقص. قبلها كان طلب واحد مرفوض
 * (403 لقائمة الأدوار مثلاً) يُفشل forkJoin كله فتظهر الصفحة فارغة كأن لا بيانات (2026-10-13).
 */
export function orEmpty<T>(onMissing: () => void): OperatorFunction<T[], T[]> {
  return catchError(() => { onMissing(); return of([] as T[]); });
}
