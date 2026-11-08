import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyApprovalsService } from '../data-access/study-approvals.service';
import { DECISIONS, StudyApproval, StudyDecision } from '../data-access/studies.models';

/**
 * قرار الموقّع على سطر توقيع: معتمد، معتمد مع ملاحظات، أو مرفوض (الأخيران يحتاجان ملاحظة).
 * يُحفظ مع القرار اسم الموقّع ونسخة توقيعه الحالية؛ أي رفض يرفض المستند كله.
 */
@Component({
  selector: 'app-study-decision-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrl: '../../../shared/styles/data-tools.scss',
  template: `
    <app-modal heading="قرار التوقيع" [subheading]="subheading()" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <fieldset class="choices">
            <legend class="form-label">القرار</legend>
            @for (d of decisions; track d.value) {
              <label class="choice" [class.on]="decision() === d.value" [class.reject]="d.value === 4">
                <input type="radio" formControlName="decision" [value]="d.value"> {{ d.label }}
              </label>
            }
          </fieldset>
          <label class="form-field"><span class="form-label">{{ noteLabel() }} @if (!needsNote()) { <small class="hint">(اختياري)</small> }</span>
            <textarea formControlName="note" rows="4" maxlength="1000"></textarea>
            @if (needsNote() && form.controls.note.touched && !form.controls.note.value.trim()) { <small class="form-error">{{ noteLabel() }} مطلوبة</small> }
          </label>
          <p class="hint-line">يُحفظ مع القرار اسمك وتوقيعك الحالي ووقت القرار، ولا يتغيّر بعد ذلك.</p>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="!valid()" label="حفظ القرار" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `,
  styles: [`
    .choices { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .choices legend { margin-bottom: 8px; }
    .choice { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border-radius: var(--radius-full);
              border: 1px solid var(--border); cursor: pointer; }
    .choice.on { border-color: var(--brand-600); background: var(--brand-50); }
    .choice.reject.on { border-color: var(--danger-500); background: var(--danger-100); }
    .hint-line { margin: 0; font-size: 12px; color: var(--ink-500); }
  `]
})
export class StudyDecisionDialog {
  private service = inject(StudyApprovalsService);

  approval = input.required<Pick<StudyApproval, 'id' | 'signerRoleName'>>();
  /** رقم المستند أو عنوانه (يظهر تحت عنوان النافذة) */
  documentLabel = input('');
  decided = output<StudyApproval>();
  closed = output<void>();

  decisions = DECISIONS;
  saving = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group({
    decision: [2 as StudyDecision, Validators.required],
    note: ['', Validators.maxLength(1000)]
  });
  decision = toSignal(this.form.controls.decision.valueChanges, { initialValue: this.form.controls.decision.value });
  private note = toSignal(this.form.controls.note.valueChanges, { initialValue: '' });

  needsNote = computed(() => DECISIONS.find(d => d.value === this.decision())?.needsNote ?? false);
  noteLabel = computed(() => this.decision() === 4 ? 'سبب الرفض' : 'الملاحظات');
  valid = computed(() => !this.needsNote() || !!this.note().trim());
  subheading = computed(() => [this.approval().signerRoleName, this.documentLabel()].filter(Boolean).join(' — '));

  save() {
    this.form.markAllAsTouched();
    if (!this.valid() || this.saving()) return;
    const v = this.form.getRawValue();
    trackRequest(this.service.decide(this.approval().id, { decision: v.decision, note: v.note }), this.saving, this.error,
      result => this.decided.emit(result));
  }
}
