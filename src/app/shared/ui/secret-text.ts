import { Component, inject, input, signal } from '@angular/core';
import { ToastService } from './toast.service';

/** قيمة حساسة (كلمة سر جهاز): مخفية افتراضياً مع زر إظهار/إخفاء ونسخ */
@Component({
  selector: 'app-secret-text', standalone: true,
  template: `
    <span class="secret">
      <span class="mono">{{ shown() ? value() : '••••••••' }}</span>
      <button type="button" class="icon-btn-sm" (click)="shown.set(!shown())"
              [attr.aria-label]="(shown() ? 'إخفاء ' : 'إظهار ') + label()" [attr.aria-pressed]="shown()">{{ shown() ? '🙈' : '👁' }}</button>
      <button type="button" class="icon-btn-sm" (click)="toast.copy(value(), label())" [attr.aria-label]="'نسخ ' + label()">⧉</button>
    </span>`
})
export class SecretText {
  value = input.required<string>();
  label = input('كلمة السر');
  protected shown = signal(false);
  protected toast = inject(ToastService);
}

/** قيمة تقنية (IP، اسم مستخدم، إحداثيات) بخط ثابت مع زر نسخ — المحتوى الإضافي (مثل شارة "مكرر") يُمرَّر بعدها */
@Component({
  selector: 'app-copy-text', standalone: true,
  template: `
    <span class="secret">
      <span class="mono">{{ value() }}</span>
      <button type="button" class="icon-btn-sm" (click)="toast.copy(value(), label())" [attr.aria-label]="'نسخ ' + label()">⧉</button>
      <ng-content />
    </span>`
})
export class CopyText {
  value = input.required<string>();
  label = input.required<string>();
  protected toast = inject(ToastService);
}
