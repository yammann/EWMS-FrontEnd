import { Component, input, output, signal } from '@angular/core';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';

/**
 * سبب إجراء لا رجعة فيه (إلغاء مستند): نص مطلوب يُحفظ في سجل الدراسة.
 * الحفظ عند الصفحة المستدعية (submitted)، وتمرّر خطأ الخادم في error وحالة الانشغال في busy.
 */
@Component({
  selector: 'app-study-reason-dialog',
  standalone: true,
  imports: [Modal, Alert, FormActions],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal [heading]="heading()" [subheading]="subheading()" [busy]="busy()" (closed)="closed.emit()">
      <form (submit)="$event.preventDefault(); send()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (hint()) { <p class="alert alert-warning" role="status">{{ hint() }}</p> }
          <label class="form-field"><span class="form-label">{{ label() }}</span>
            <textarea #box rows="4" maxlength="1000" [value]="reason()" (input)="reason.set(box.value)"></textarea>
          </label>
        </div>
        <app-form-actions [busy]="busy()" [disabled]="!reason().trim()" [label]="confirmLabel()" busyLabel="جارٍ التنفيذ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyReasonDialog {
  heading = input.required<string>();
  subheading = input('');
  label = input('السبب');
  hint = input('');
  confirmLabel = input('تأكيد');
  busy = input(false);
  error = input('');
  submitted = output<string>();
  closed = output<void>();

  reason = signal('');

  send() {
    const text = this.reason().trim();
    if (text && !this.busy()) this.submitted.emit(text);
  }
}
