import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

/**
 * رسالة خطأ موحّدة (لا تُرسم إن كانت الرسالة فارغة). الشكل من الفئات العامة `.alert .alert-error`.
 * `retryLabel` يضيف زراً (مثل «إعادة المحاولة» لخطأ التحميل) يُطلق `retry`.
 * داخل نافذة يتمرّر جسمها: يثبت التنبيه أعلاه (styles/_overlays.scss) ويُمرَّر إليه عند ظهوره، فلا يفوت من ملأ نموذجاً طويلاً ونزل إلى آخره.
 */
@Component({
  selector: 'app-alert', standalone: true,
  template: `
    @if (message()) {
      <p #box class="alert alert-error" role="alert">
        <span>{{ message() }}</span>
        @if (retryLabel()) { <button type="button" class="btn btn-ghost btn-sm alert-action" (click)="retry.emit()">{{ retryLabel() }}</button> }
      </p>
    }`,
  styles: [`:host { display: contents; } .alert-action { margin-inline-start: auto; flex: none; }`]
})
export class Alert {
  message = input<string | null | undefined>('');
  retryLabel = input('');
  retry = output<void>();
  private box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    // عند ظهور رسالة جديدة: أظهِرها إن كانت خارج مجال الرؤية (بعد رسم العنصر)
    effect(() => {
      if (!this.message()) return;
      setTimeout(() => this.box()?.nativeElement.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
    });
  }
}
