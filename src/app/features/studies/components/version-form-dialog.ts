import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDrawingsService } from '../data-access/study-drawings.service';
import { ArchitecturalVersion, StudyDrawing } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

/**
 * نسخة جديدة (Draft-N) من المخطط المعماري أو تعديل نسخة قيد الإعداد: تاريخها ووصف محتواها.
 * لا تُنشأ نسخة جديدة وفي المخطط نسخة قيد الإعداد أو بانتظار الاعتماد (يرفضه الخادم).
 * تعيد العملية المخطط كاملاً بنسخه.
 */
@Component({
  selector: 'app-study-version-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="version() ? 'تعديل النسخة ' + version()!.label : 'نسخة معمارية جديدة'" [subheading]="drawing().name" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <label class="form-field"><span class="form-label">تاريخ النسخة</span><input type="date" formControlName="versionDate"></label>
          <label class="form-field"><span class="form-label">المحتوى <small class="hint">(ما تضمنته النسخة)</small></span><textarea formControlName="content" rows="4" maxlength="4000"></textarea></label>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyVersionFormDialog implements OnInit {
  private service = inject(StudyDrawingsService);
  private fb = inject(FormBuilder);

  drawing = input.required<StudyDrawing>();
  /** null = نسخة جديدة */
  version = input<ArchitecturalVersion | null>(null);
  saved = output<StudyDrawing>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group({ versionDate: [localDateInput(), Validators.required], content: [''] });

  ngOnInit() {
    const v = this.version();
    if (v) this.form.patchValue({ versionDate: dateOnly(v.versionDate), content: v.content ?? '' });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const v = this.version();
    const body = { versionDate: f.versionDate, content: optional(f.content), rowVersion: v?.rowVersion ?? null };
    const call = v ? this.service.updateVersion(v.id, body) : this.service.createVersion(this.drawing().id, body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
