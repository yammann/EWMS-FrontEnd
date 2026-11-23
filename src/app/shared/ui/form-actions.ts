import { Component, input, output } from '@angular/core';
import { ActionIcon, ActionKind } from './action-icon';

/** شريط أزرار نافذة النموذج: «إلغاء» + زر إرسال (يعطَّل أثناء الانشغال ويتبدّل نصّه). الشكل من .modal-actions العام. */
@Component({
  selector: 'app-form-actions', standalone: true, imports: [ActionIcon],
  template: `
    <footer class="modal-actions">
      <button type="button" class="ghost" (click)="dismissed.emit()" [disabled]="busy()">{{ cancelLabel() }}</button>
      <button type="submit" [disabled]="busy() || disabled()" [attr.aria-busy]="busy()">
        @if (action(); as kind) { <app-action-icon [kind]="kind" [busy]="busy()" /> }
        <span>{{ busy() ? busyLabel() : label() }}</span>
      </button>
    </footer>`,
  styles: [`:host { display: contents; }`]
})
export class FormActions {
  busy = input(false);
  /** تعطيل الإرسال لسبب غير الانشغال (نموذج غير صالح...) */
  disabled = input(false);
  label = input('حفظ');
  action = input<ActionKind | null>('save');
  busyLabel = input('جارٍ الحفظ…');
  cancelLabel = input('إلغاء');
  dismissed = output<void>();
}
