import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyProjectsService } from '../data-access/study-projects.service';
import { ProjectStage, StageTask, StageTaskInput, StudyProject, StudyTaskTarget, TASK_TARGETS } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

/**
 * مهمة في مرحلة: توجَّه إلى قسم مشارك، أو مكتب من قسم مشارك، أو عضو في الفريق (جهة واحدة فقط).
 * الاختيارات من تفاصيل المشروع نفسها (الأقسام ومكاتبها وأعضاؤها) فلا تحتاج قوائم الهيكل.
 * تحديث نسبة الإنجاز للمكلَّف وحده من نافذته (TaskProgressDialog).
 */
@Component({
  selector: 'app-study-task-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="task() ? 'تعديل المهمة' : 'مهمة جديدة'" [subheading]="stage().stageTypeName" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (!project().departments.length) { <p class="alert alert-warning" role="status">أضف قسماً مشاركاً للمشروع أولاً ثم أسند المهام.</p> }
          <div class="form-grid-2">
            <label class="form-field full"><span class="form-label">عنوان المهمة</span><input formControlName="title" maxlength="200">
              @if (form.controls.title.touched && form.controls.title.invalid) { <small class="form-error">العنوان مطلوب</small> }</label>
            <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="2000"></textarea></label>

            <label class="form-field"><span class="form-label">تُسنَد إلى</span>
              <select formControlName="targetType">@for (t of targets; track t.value) { <option [ngValue]="t.value">{{ t.label }}</option> }</select></label>

            @switch (target()) {
              @case (1) {
                <label class="form-field"><span class="form-label">القسم المشارك</span>
                  <select formControlName="departmentId">
                    <option [ngValue]="0" disabled>اختر…</option>
                    @for (d of project().departments; track d.departmentId) { <option [ngValue]="d.departmentId">{{ d.departmentName }}</option> }
                  </select></label>
              }
              @case (2) {
                <label class="form-field"><span class="form-label">القسم</span>
                  <select formControlName="officeDepartmentId">
                    <option [ngValue]="0" disabled>اختر…</option>
                    @for (d of project().departments; track d.departmentId) { <option [ngValue]="d.departmentId">{{ d.departmentName }}</option> }
                  </select></label>
                <label class="form-field"><span class="form-label">المكتب</span>
                  <select formControlName="officeId">
                    <option [ngValue]="0" disabled>اختر…</option>
                    @for (o of offices(); track o.id) { <option [ngValue]="o.id">{{ o.name }}</option> }
                  </select>
                  @if (form.controls.officeDepartmentId.value && !offices().length) { <small class="hint">لا مكاتب لهذا القسم.</small> }</label>
              }
              @case (3) {
                <label class="form-field"><span class="form-label">عضو الفريق</span>
                  <select formControlName="assigneeUserId">
                    <option [ngValue]="0" disabled>اختر…</option>
                    @for (m of members(); track m.userId) { <option [ngValue]="m.userId">{{ m.fullName }} — {{ m.department }}</option> }
                  </select>
                  @if (!members().length) { <small class="hint">لا أعضاء في الفريق بعد — يضيفهم رئيس كل قسم مشارك.</small> }</label>
              }
            }

            <label class="form-field"><span class="form-label">الوزن في نسبة المرحلة</span><input type="number" formControlName="weight" min="0" step="any"></label>
            <label class="form-field"><span class="form-label">بدء مخطط</span><input type="date" formControlName="plannedStartDate"></label>
            <label class="form-field"><span class="form-label">نهاية مخططة</span><input type="date" formControlName="plannedEndDate">
              @if (form.hasError('range')) { <small class="form-error">النهاية قبل البداية</small> }</label>
          </div>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid || !targetChosen()" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyTaskFormDialog implements OnInit {
  private service = inject(StudyProjectsService);
  private fb = inject(FormBuilder);

  project = input.required<StudyProject>();
  stage = input.required<ProjectStage>();
  /** null = مهمة جديدة */
  task = input<StageTask | null>(null);
  saved = output<StageTask>();
  closed = output<void>();

  targets = TASK_TARGETS;
  saving = signal(false);
  error = signal('');

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    targetType: [StudyTaskTarget.Department as StudyTaskTarget],
    departmentId: [0],
    officeDepartmentId: [0],
    officeId: [0],
    assigneeUserId: [0],
    weight: [10, [Validators.required, Validators.min(0)]],
    plannedStartDate: [''],
    plannedEndDate: ['']
  }, { validators: group => {
    const a = group.get('plannedStartDate')?.value, b = group.get('plannedEndDate')?.value;
    return a && b && b < a ? { range: true } : null;
  } });

  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  target = computed(() => this.values().targetType ?? StudyTaskTarget.Department);
  offices = computed(() => this.project().departments.find(d => d.departmentId === this.values().officeDepartmentId)?.offices ?? []);
  members = computed(() => this.project().departments.flatMap(d => d.members.map(m => ({ ...m, department: d.departmentName }))));
  /** الجهة المطلوبة لنوع الهدف المختار مملوءة */
  targetChosen = computed(() => {
    const v = this.values();
    return this.target() === 1 ? !!v.departmentId : this.target() === 2 ? !!v.officeId : !!v.assigneeUserId;
  });

  ngOnInit() {
    const t = this.task();
    if (!t) return;
    const officeDepartment = t.officeId ? this.project().departments.find(d => d.offices.some(o => o.id === t.officeId))?.departmentId ?? 0 : 0;
    this.form.patchValue({
      title: t.title, description: t.description ?? '', targetType: t.targetType,
      departmentId: t.departmentId ?? 0, officeDepartmentId: officeDepartment, officeId: t.officeId ?? 0, assigneeUserId: t.assigneeUserId ?? 0,
      weight: t.weight, plannedStartDate: dateOnly(t.plannedStartDate), plannedEndDate: dateOnly(t.plannedEndDate)
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.targetChosen() || this.saving()) return;
    const v = this.form.getRawValue();
    const t = this.task();
    const body: StageTaskInput = {
      stageId: this.stage().id, targetType: v.targetType,
      departmentId: v.targetType === 1 ? v.departmentId : null,
      officeId: v.targetType === 2 ? v.officeId : null,
      assigneeUserId: v.targetType === 3 ? v.assigneeUserId : null,
      title: v.title.trim(), description: optional(v.description),
      plannedStartDate: v.plannedStartDate || null, plannedEndDate: v.plannedEndDate || null,
      weight: v.weight, rowVersion: t?.rowVersion ?? null
    };
    const call = t ? this.service.updateTask(t.id, body) : this.service.createTask(body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
