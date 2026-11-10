import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { ProjectStage, StudyLinkedDocument, StudyProject, StudyStageInput, StudyStageType } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';

/**
 * مرحلة عمل في المشروع: نوعها من أنواع المراحل الفعّالة، ووزنها في نسبة المشروع، وتواريخها المخططة، والقسم المسؤول عنها
 * (من الأقسام المشاركة). مراحل المستندات (مرتبطة بمستند) تُنشأ مغلقة من النظام ولا تُعدَّل هنا.
 * التحرير: لا يتغيّر نوع المرحلة، والحالة «لم تبدأ/قيد التنفيذ» فقط (الإغلاق بإجرائه).
 */
@Component({
  selector: 'app-study-stage-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="stage() ? 'تعديل المرحلة' : 'إضافة مرحلة'" [subheading]="project().code" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (missing()) { <p class="alert alert-warning" role="status">{{ missing() }}</p> }
          <div class="form-grid-2">
            <label class="form-field full"><span class="form-label">نوع المرحلة</span>
              <select formControlName="stageTypeId">
                <option [ngValue]="0" disabled>اختر…</option>
                @for (t of types(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
              </select>
              @if (form.controls.stageTypeId.touched && form.controls.stageTypeId.invalid) { <small class="form-error">اختر نوع المرحلة</small> }</label>
            <label class="form-field"><span class="form-label">الوزن في نسبة المشروع</span><input type="number" formControlName="weight" min="0" step="any"></label>
            <label class="form-field"><span class="form-label">القسم المسؤول</span>
              <select formControlName="responsibleDepartmentId">
                <option [ngValue]="0">— بلا —</option>
                @for (d of project().departments; track d.departmentId) { <option [ngValue]="d.departmentId">{{ d.departmentName }}</option> }
              </select></label>
            <label class="form-field"><span class="form-label">بدء مخطط</span><input type="date" formControlName="plannedStartDate"></label>
            <label class="form-field"><span class="form-label">نهاية مخططة</span><input type="date" formControlName="plannedEndDate">
              @if (form.hasError('range')) { <small class="form-error">النهاية قبل البداية</small> }</label>
            @if (stage()) {
              <label class="form-field"><span class="form-label">بدء فعلي</span><input type="date" formControlName="actualStartDate"></label>
              <label class="form-field"><span class="form-label">الحالة</span>
                <select formControlName="status"><option [ngValue]="1">لم تبدأ</option><option [ngValue]="2">قيد التنفيذ</option></select></label>
            }
          </div>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyStageFormDialog implements OnInit {
  private service = inject(StudyProjectsService);
  private lookups = inject(StudyLookupsService);
  private fb = inject(FormBuilder);

  project = input.required<StudyProject>();
  /** null = مرحلة جديدة */
  stage = input<ProjectStage | null>(null);
  saved = output<ProjectStage>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  missing = signal('');
  stageTypes = signal<StudyStageType[]>([]);
  /** الأنواع الفعّالة غير المرتبطة بمستند (مراحل المستندات يُنشئها النظام) + نوع المرحلة الحالية عند التعديل */
  types = computed(() => {
    const current = this.stage();
    return this.stageTypes().filter(t => t.id === current?.stageTypeId || (t.isActive && t.linkedDocument === StudyLinkedDocument.None));
  });

  form = this.fb.nonNullable.group({
    stageTypeId: [0, Validators.min(1)],
    weight: [10, [Validators.required, Validators.min(0)]],
    responsibleDepartmentId: [0],
    plannedStartDate: [''],
    plannedEndDate: [''],
    actualStartDate: [''],
    status: [1 as 1 | 2]
  }, { validators: group => {
    const a = group.get('plannedStartDate')?.value, b = group.get('plannedEndDate')?.value;
    return a && b && b < a ? { range: true } : null;
  } });

  ngOnInit() {
    const s = this.stage();
    if (s) {
      this.form.patchValue({
        stageTypeId: s.stageTypeId, weight: s.weight, responsibleDepartmentId: s.responsibleDepartmentId ?? 0,
        plannedStartDate: dateOnly(s.plannedStartDate), plannedEndDate: dateOnly(s.plannedEndDate),
        actualStartDate: dateOnly(s.actualStartDate), status: s.status === 2 ? 2 : 1
      });
      this.form.controls.stageTypeId.disable();
    }
    this.lookups.stageTypes().pipe(orEmpty(() => this.missing.set('تعذّر تحميل أنواع المراحل (تحتاج «عرض قوائم الدراسات»).')))
      .subscribe(list => this.stageTypes.set(list));
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const s = this.stage();
    const body: StudyStageInput = {
      projectId: this.project().id, stageTypeId: v.stageTypeId, weight: v.weight,
      plannedStartDate: v.plannedStartDate || null, plannedEndDate: v.plannedEndDate || null,
      responsibleDepartmentId: v.responsibleDepartmentId || null,
      ...(s ? { actualStartDate: v.actualStartDate || null, status: v.status, rowVersion: s.rowVersion } : {})
    };
    const call = s ? this.service.updateStage(s.id, body) : this.service.createStage(body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
