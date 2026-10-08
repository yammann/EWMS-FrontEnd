import { Component, inject, input } from '@angular/core';
import { ToastService } from '@shared/ui/toast.service';

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
