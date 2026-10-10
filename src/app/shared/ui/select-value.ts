import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * قيمة <select> غير المرتبط بنموذج: `<select [appSelectValue]="x()">`.
 * بديل عن `[value]` على <select> الذي يُطبَّق قبل رسم الخيارات (@for) فيظهر الخيار الأول بدل القيمة الفعلية
 * (حجم الصفحة المحفوظ، فلاتر من الرابط، سنة العطل…). يعيد تطبيق القيمة عند تغيّرها وعند تغيّر الخيارات.
 */
@Directive({ selector: 'select[appSelectValue]', standalone: true })
export class SelectValue {
  appSelectValue = input<unknown>();

  constructor() {
    const el = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
    const apply = () => {
      const v = this.appSelectValue();
      const s = v == null ? '' : String(v);
      if (el.value !== s) el.value = s;
    };
    effect(() => { this.appSelectValue(); apply(); });
    // خيارات تصل لاحقاً (من الخادم) — نعيد التطبيق بعد إضافتها
    const observer = new MutationObserver(apply);
    observer.observe(el, { childList: true, subtree: true });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
