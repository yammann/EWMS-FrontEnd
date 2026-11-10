import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDrawingsService } from '../data-access/study-drawings.service';
import { DesignApproval } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

/** النسخة التي يُصدَر لها اعتماد المخططات الأولي */
export interface CdaVersion { id: number; label: string; drawingName: string; }

/**
 * اعتماد المخططات الأولي (CDA) لنسخة معمارية: تاريخه ومحتواه وملاحظاته الفنية.
 * إصداره ينشئ سطور التواقيع الثلاثة (القسم المرسل، إدارة التصميم، ضبط الجودة)، ولا يُعدَّل بعد أول توقيع.
 */
@Component({
  selector: 'app-study-design-approval-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="approval() ? 'تعديل اعتماد المخططات الأولي' : 'إصدار اعتماد المخططات الأولي (CDA)'" [subheading]="subheading()" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (!approval()) { <p class="context">يُنشأ للنسخة <strong>{{ version()?.label }}</strong> من «{{ version()?.drawingName }}»، وتُنشأ معه سطور التواقيع الثلاثة فوراً.</p> }
          <label class="form-field"><span class="form-label">تاريخ الاعتماد</span><input type="date" formControlName="cdaDate"></label>
          <label class="form-field"><span class="form-label">المحتوى <small class="hint">(اختياري)</small></span><textarea formControlName="content" rows="3" maxlength="4000"></textarea></label>
          <label class="form-field"><span class="form-label">الملاحظات الفنية <small class="hint">(اختياري)</small></span><textarea formControlName="technicalNotes" rows="3" maxlength="4000"></textarea></label>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyDesignApprovalFormDialog implements OnInit {
  private service = inject(StudyDrawingsService);
  private fb = inject(FormBuilder);

  /** إصدار جديد: النسخة المعمارية */
  version = input<CdaVersion | null>(null);
  /** تعديل: الاعتماد القائم */
  approval = input<DesignApproval | null>(null);
  saved = output<DesignApproval>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({ cdaDate: [localDateInput(), Validators.required], content: [''], technicalNotes: [''] });

  subheading() { return this.approval()?.cdaNumber ?? this.version()?.label ?? ''; }

  ngOnInit() {
    const a = this.approval();
    if (a) this.form.patchValue({ cdaDate: dateOnly(a.cdaDate), content: a.content ?? '', technicalNotes: a.technicalNotes ?? '' });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const a = this.approval();
    const body = {
      versionId: a?.versionId ?? this.version()!.id, cdaDate: f.cdaDate,
      content: optional(f.content), technicalNotes: optional(f.technicalNotes), rowVersion: a?.rowVersion ?? null
    };
    const call = a ? this.service.updateDesignApproval(a.id, body) : this.service.createDesignApproval(body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
