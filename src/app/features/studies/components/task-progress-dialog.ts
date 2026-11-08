import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { StageTask, StudyTaskStatus, TASK_STATUSES } from '../data-access/studies.models';

/**
 * تحديث إنجاز مهمة (للمكلَّف أو مكتبه أو موظفي قسمه، علم canUpdateProgress): النسبة 0–100 والحالة.
 * تتبدّل الحالة تلقائياً مع النسبة (0 لم تبدأ، 100 منجزة، بينهما قيد التنفيذ) ويمكن تعديلها يدوياً.
 * أول تقدّم يحرّك مرحلة المهمة إلى «قيد التنفيذ»، والخادم يحسب نسبة المرحلة والمشروع من الأوزان.
 */
@Component({
  selector: 'app-study-task-progress-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal heading="تحديث الإنجاز" [subheading]="task().title" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <p class="context">{{ task().projectCode }} — {{ task().stageName }} · أسندها {{ task().assignedByName }}</p>
          <label class="form-field"><span class="form-label">نسبة الإنجاز: <strong>{{ form.controls.progress.value }}%</strong></span>
            <input type="range" formControlName="progress" min="0" max="100" step="5" (input)="sync()">
            <input type="number" formControlName="progress" min="0" max="100" step="1" (input)="sync()" aria-label="نسبة الإنجاز"></label>
          <label class="form-field"><span class="form-label">الحالة</span>
            <select formControlName="status">@for (s of statuses; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }</select></label>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyTaskProgressDialog implements OnInit {
  private service = inject(StudyProjectsService);
  private fb = inject(FormBuilder);

  task = input.required<StageTask>();
  saved = output<StageTask>();
  closed = output<void>();

  statuses = TASK_STATUSES;
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    status: [StudyTaskStatus.NotStarted as StudyTaskStatus]
  });

  ngOnInit() { this.form.setValue({ progress: this.task().progress, status: this.task().status }); }

  /** الحالة تتبع النسبة */
  sync() {
    const p = Number(this.form.controls.progress.value) || 0;
    this.form.controls.status.setValue(p >= 100 ? StudyTaskStatus.Done : p > 0 ? StudyTaskStatus.InProgress : StudyTaskStatus.NotStarted);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    trackRequest(this.service.updateProgress(this.task().id, { progress: Number(v.progress), status: v.status }), this.saving, this.error, saved => this.saved.emit(saved));
  }
}
