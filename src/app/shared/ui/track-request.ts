import { DestroyRef, WritableSignal, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

/**
 * طلب واحد بنمط الصفحات الموحّد: يرفع مؤشر الانشغال ويصفّر الخطأ، ثم يطفئ المؤشر ويستدعي next عند النجاح،
 * وعند الفشل يطفئ المؤشر ويضع رسالة الخطأ في إشارة الصفحة. (صفحات الإدارة ذات القوائم تستعمل CrudPage)
 * للعمليات المفردة (حفظ، حذف، إرسال). تحميل قائمة أو صفحة يستعمل latestRequest.
 */
export function trackRequest<T>(source: Observable<T>, busy: WritableSignal<boolean>, error: WritableSignal<string>, next: (value: T) => void): Subscription {
  busy.set(true); error.set('');
  return source.subscribe({
    next: value => { busy.set(false); next(value); },
    error: e => { busy.set(false); error.set((e as { message?: string } | null)?.message ?? ''); }
  });
}

/**
 * مثل trackRequest، لكن كل استدعاء يلغي الطلب السابق إن لم ينتهِ بعد، ويُلغى الأخير عند إغلاق الصفحة.
 * لتحميل القوائم والصفحات (بحث، فلاتر، ترقيم، إعادة تحميل عند إشعار): على شبكة بطيئة قد يصل ردّ قديم
 * بعد الأحدث فيستبدل النتائج الحالية — هنا لا يصل أصلاً. لا يُستعمل للحفظ: إلغاء الطلب لا يلغي ما نفّذه الخادم.
 * يُنشأ كحقل في المكوّن (يحتاج سياق الحقن): `private latest = latestRequest();`
 */
export function latestRequest() {
  let current: Subscription | undefined;
  inject(DestroyRef).onDestroy(() => current?.unsubscribe());
  return <T>(source: Observable<T>, busy: WritableSignal<boolean>, error: WritableSignal<string>, next: (value: T) => void) => {
    current?.unsubscribe();
    current = trackRequest(source, busy, error, next);
  };
}
