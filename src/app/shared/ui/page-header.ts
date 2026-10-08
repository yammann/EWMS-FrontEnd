import { Component, input } from '@angular/core';

/**
 * رأس الصفحة الموحّد: عنوان علوي صغير + عنوان رئيسي + وصف، والأزرار تُمرَّر كمحتوى (تظهر في `.header-actions`).
 * الشكل من الفئات العامة `.page-header` (src/styles/_base.scss). زر الرجوع في الشريط العلوي للتخطيط، لا هنا.
 */
@Component({
  selector: 'app-page-header', standalone: true,
  template: `
    <header class="page-header">
      <div>
        @if (eyebrow()) { <span class="eyebrow">{{ eyebrow() }}</span> }
        <h1>{{ heading() }}</h1>
        @if (subtitle()) { <p class="muted">{{ subtitle() }}</p> }
      </div>
      <div class="header-actions"><ng-content /></div>
    </header>`,
  styles: [`:host { display: contents; } .header-actions:empty { display: none; }`]
})
export class PageHeader {
  eyebrow = input('');
  heading = input.required<string>();
  subtitle = input('');
}
