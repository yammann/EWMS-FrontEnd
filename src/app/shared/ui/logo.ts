import { Component, input } from '@angular/core';

/**
 * شعار الهوية البصرية السورية — لونه من CSS (currentColor)، افتراضياً الذهبي --accent.
 * الحجم من CSS للعنصر نفسه (width/height).
 * الرسم من الملف public/brand/logo.svg كقناع CSS ملوّن بلون النص (خارج حزمة JavaScript — تخفيف الحزمة الأولى،
 * 2026-10-14)؛ يُطبع بلونه (print-color-adjust) في أوراق الطباعة.
 */
@Component({
  selector: 'app-logo', standalone: true,
  template: `<span class="mark"></span>`,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  styles: [`
    :host { display: inline-block; color: var(--accent); line-height: 0; }
    .mark {
      display: block; width: 100%; height: 100%;
      background: currentColor;
      -webkit-mask: url(/brand/logo.svg) center / contain no-repeat;
      mask: url(/brand/logo.svg) center / contain no-repeat;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }`]
})
export class Logo {
  label = input('شعار الجمهورية العربية السورية');
}
