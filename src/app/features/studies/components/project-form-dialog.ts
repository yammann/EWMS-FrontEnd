import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyProjectsService } from '../data-access/study-projects.service';
import {
  EDITABLE_PROJECT_STATUSES, StudyEmployee, StudyProject, StudyProjectInput, StudyProjectStatus, StudyStartOrder
} from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

/**
 * مشروع الدراسة: يُنشأ من أمر بدء معتمد (الاسم، تواريخ التخطيط، وكوده إن لم يكن للتكليف كود)،
 * ويُعدَّل اسمه وتواريخه ومديره وحالته (جارٍ/معلّق). الإكمال والإلغاء بإجراءاتهما من صفحة المشروع.
 * المدير موظف نشط من فرع المشروع.
 */
@Component({
  selector: 'app-study-project-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="project() ? 'تعديل المشروع' : 'إنشاء مشروع من أمر البدء'" [subheading]="subheading()" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (missing()) { <p class="alert alert-warning" role="status">{{ missing() }}</p> }
          <div class="form-grid-2">
            <label class="form-field full"><span class="form-label">اسم المشروع</span><input formControlName="name" maxlength="200">
              @if (form.controls.name.touched && form.controls.name.invalid) { <small class="form-error">اسم المشروع مطلوب</small> }</label>
            @if (needsCode()) {
              <label class="form-field"><span class="form-label">كود المشروع</span><input formControlName="code" maxlength="50" dir="ltr">
                @if (form.controls.code.touched && form.controls.code.invalid) { <small class="form-error">التكليف بلا كود: اكتب كود المشروع</small> }</label>
            }
            <label class="form-field"><span class="form-label">بدء الدراسة المخطط</span><input type="date" formControlName="plannedStartDate"></label>
            <label class="form-field"><span class="form-label">نهاية الدراسة المخططة</span><input type="date" formControlName="plannedEndDate">
              @if (form.hasError('range')) { <small class="form-error">النهاية قبل البداية</small> }</label>
            <label class="form-field"><span class="form-label">مدير المشروع</span>
              <select formControlName="managerUserId">
                <option [ngValue]="0">{{ project() ? '— بلا تغيير —' : '— مدير أمر البدء —' }}</option>
                @for (e of employees(); track e.id) { <option [ngValue]="e.id">{{ e.fullName }}{{ e.departmentName ? ' — ' + e.departmentName : '' }}</option> }
              </select></label>
            @if (project()) {
              <label class="form-field"><span class="form-label">الحالة</span>
                <select formControlName="status">@for (s of statuses; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }</select></label>
            }
          </div>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyProjectFormDialog implements OnInit {
  private service = inject(StudyProjectsService);
  private lookups = inject(StudyLookupsService);
  private fb = inject(FormBuilder);

  /** إنشاء: أمر البدء المعتمد */
  startOrder = input<StudyStartOrder | null>(null);
  /** تعديل: المشروع القائم */
  project = input<StudyProject | null>(null);
  saved = output<StudyProject>();
  closed = output<void>();

  statuses = EDITABLE_PROJECT_STATUSES;
  saving = signal(false);
  error = signal('');
  missing = signal('');
  employees = signal<StudyEmployee[]>([]);

  needsCode = computed(() => !this.project() && !this.startOrder()?.projectCode);
  subheading = computed(() => this.project()?.code ?? ('أمر البدء ' + (this.startOrder()?.orderNumber ?? '')));

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    code: [''],
    plannedStartDate: ['', Validators.required],
    plannedEndDate: ['', Validators.required],
    managerUserId: [0],
    status: [1 as StudyProjectStatus]
  }, { validators: group => {
    const a = group.get('plannedStartDate')?.value, b = group.get('plannedEndDate')?.value;
    return a && b && b < a ? { range: true } : null;
  } });

  ngOnInit() {
    const p = this.project(), o = this.startOrder();
    if (p) {
      this.form.patchValue({
        name: p.name, plannedStartDate: dateOnly(p.plannedStartDate), plannedEndDate: dateOnly(p.plannedEndDate),
        status: p.status === 2 ? 2 : 1
      });
    } else if (o) {
      this.form.patchValue({ plannedStartDate: dateOnly(o.studyStartDate), plannedEndDate: dateOnly(o.studyDeadline) });
      if (this.needsCode()) this.form.controls.code.addValidators(Validators.required);
    }
    const branchId = p?.branchId ?? o?.branchId;
    if (branchId) {
      this.lookups.employees({ branchId }).pipe(orEmpty(() => this.missing.set('تعذّر تحميل موظفي الفرع — يبقى المدير كما هو.')))
        .subscribe(list => this.employees.set(list));
    }
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const p = this.project();
    const body: StudyProjectInput = {
      startOrderId: p?.startOrderId ?? this.startOrder()!.id,
      name: v.name.trim(), plannedStartDate: v.plannedStartDate, plannedEndDate: v.plannedEndDate,
      managerUserId: v.managerUserId || null,
      ...(p ? { status: v.status, rowVersion: p.rowVersion } : { code: optional(v.code) })
    };
    const call = p ? this.service.update(p.id, body) : this.service.create(body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
