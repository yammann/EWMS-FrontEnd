import { WritableSignal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * طلب واحد بنمط الصفحات الموحّد: يرفع مؤشر الانشغال ويصفّر الخطأ، ثم يطفئ المؤشر ويستدعي next عند النجاح،
 * وعند الفشل يطفئ المؤشر ويضع رسالة الخطأ في إشارة الصفحة. (صفحات الإدارة ذات القوائم تستعمل CrudPage)
 */
export function trackRequest<T>(source: Observable<T>, busy: WritableSignal<boolean>, error: WritableSignal<string>, next: (value: T) => void) {
  busy.set(true); error.set('');
  source.subscribe({
    next: value => { busy.set(false); next(value); },
    error: e => { busy.set(false); error.set((e as { message?: string } | null)?.message ?? ''); }
  });
}
