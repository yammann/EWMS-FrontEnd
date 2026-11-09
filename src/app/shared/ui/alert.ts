import { Component, ElementRef, effect, input, output, untracked, viewChild } from '@angular/core';

/**
 * رسالة خطأ موحّدة (لا تُرسم إن كانت الرسالة فارغة). الشكل من الفئات العامة `.alert .alert-error`.
 * `retryLabel` يضيف زراً (مثل «إعادة المحاولة» لخطأ التحميل) يُطلق `retry`.
 * عند ظهور رسالة جديدة يُمرَّر إليها الحاوي (نافذة طويلة) كي لا يضيع الخطأ فوق أو تحت ما يراه المستخدم.
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
    effect(() => {
      if (!this.message()) return;
      // بعد رسم الشريط: أقل تمرير ممكن ليظهر (في نافذة تُمرَّر إلى رأسها حيث يقع الشريط)
      untracked(() => setTimeout(() => this.box()?.nativeElement.scrollIntoView?.({ block: 'nearest' })));
    });
  }
}
