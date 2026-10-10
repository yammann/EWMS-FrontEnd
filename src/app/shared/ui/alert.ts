import { Component, input, output } from '@angular/core';

/**
 * رسالة خطأ موحّدة (لا تُرسم إن كانت الرسالة فارغة). الشكل من الفئات العامة `.alert .alert-error`.
 * `retryLabel` يضيف زراً (مثل «إعادة المحاولة» لخطأ التحميل) يُطلق `retry`.
 */
@Component({
  selector: 'app-alert', standalone: true,
  template: `
    @if (message()) {
      <p class="alert alert-error" role="alert">
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
}
