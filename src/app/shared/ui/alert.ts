import { Component, input } from '@angular/core';

/** رسالة خطأ موحّدة (لا تُرسم إن كانت الرسالة فارغة). الشكل من الفئات العامة `.alert .alert-error`. */
@Component({
  selector: 'app-alert', standalone: true,
  template: `@if (message()) { <p class="alert alert-error" role="alert">{{ message() }}</p> }`,
  styles: [`:host { display: contents; }`]
})
export class Alert {
  message = input<string | null | undefined>('');
}
