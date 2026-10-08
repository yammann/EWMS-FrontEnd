import { DestroyRef, Signal, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, finalize, switchMap } from 'rxjs';
import { errorMessage } from './page-actions';

export interface Loader<T> {
  /** آخر بيانات وصلت (تبقى معروضة أثناء إعادة التحميل) */
  data: Signal<T>;
  loading: Signal<boolean>;
  /** رسالة آخر خطأ تحميل ('' إن نجح) */
  error: Signal<string>;
  /** يعيد التحميل (يلغي أي طلب جارٍ ويتجاهل رده القديم) */
  reload(): void;
}

/**
 * تحميل بيانات صفحة بنمط موحّد (loading / error / data) بدل subscribe يدوي في كل صفحة.
 * يُنشأ كحقل في المكوّن (سياق الحقن) ويبدأ التحميل فوراً؛ ويُلغى تلقائياً عند تدمير المكوّن.
 *   items = loader(() => this.service.getAll(), []);
 *   في القالب: items.data() / items.loading() / items.error()
 */
export function loader<T>(source: () => Observable<T>, initial: T, opts: { immediate?: boolean; onLoaded?: (data: T) => void; onError?: (error: unknown) => void } = {}): Loader<T> {
  const data = signal<T>(initial);
  const loading = signal(false);
  const error = signal('');
  const trigger = new Subject<void>();

  trigger.pipe(
    switchMap(() => {
      loading.set(true); error.set('');
      return source().pipe(
        catchError(e => { error.set(errorMessage(e, 'تعذر تحميل البيانات')); opts.onError?.(e); return EMPTY; }),
        finalize(() => loading.set(false))
      );
    }),
    takeUntilDestroyed(inject(DestroyRef))
  ).subscribe(value => { data.set(value); opts.onLoaded?.(value); });

  const reload = () => trigger.next();
  if (opts.immediate !== false) { loading.set(true); queueMicrotask(reload); }
  return { data: data.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly(), reload };
}

/**
 * طلب واحد بنمط الصفحات الموحّد: يرفع مؤشر الانشغال ويصفّر الخطأ، ثم يطفئ المؤشر ويستدعي next عند النجاح،
 * وعند الفشل يطفئ المؤشر ويضع رسالة الخطأ في إشارة الصفحة. (للطلبات التي لا تستحق loader() الكامل)
 */
export function trackRequest<T>(source: Observable<T>, busy: WritableSignal<boolean>, error: WritableSignal<string>, next: (value: T) => void) {
  busy.set(true); error.set('');
  source.subscribe({
    next: value => { busy.set(false); next(value); },
    error: e => { busy.set(false); error.set((e as { message?: string } | null)?.message ?? ''); }
  });
}
