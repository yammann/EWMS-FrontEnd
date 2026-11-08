import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppPermission } from '@core/constants/access';
import { AuthService } from '@core/services/auth.service';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDrawingsService } from '../data-access/study-drawings.service';
import { BasisOption, DRAWING_KINDS, DrawingKind, StudyDrawing, StudyDrawingInput, StudyProject } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

/**
 * مخطط في المشروع (معماري، إنشائي، كهرباء وميكانيك، تصميم داخلي، تقني): الاسم والرقم والتاريخ والوصف والمكتب.
 * غير المعماري «مبني على» نسخة معمارية معتمدة من المشروع. عند التعديل تُرسل الحالة (قيد الإعداد أو بانتظار المراجعة)؛
 * الاعتماد بالمراجعة أو CDA. من يتصفح المؤسسة يختار القسم المُصدِر، وغيره يصدر المخطط باسم قسمه.
 */
@Component({
  selector: 'app-study-drawing-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal [heading]="drawing() ? 'تعديل المخطط' : 'مخطط جديد'" [subheading]="project().code" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">نوع المخطط</span>
              <select formControlName="kind">@for (k of kinds; track k.value) { <option [ngValue]="k.value">{{ k.label }}</option> }</select></label>
            <label class="form-field"><span class="form-label">رقم المخطط</span><input formControlName="drawingNumber" maxlength="50" dir="ltr">
              @if (form.controls.drawingNumber.touched && form.controls.drawingNumber.invalid) { <small class="form-error">رقم المخطط مطلوب</small> }</label>
            <label class="form-field full"><span class="form-label">اسم المخطط</span><input formControlName="name" maxlength="200">
              @if (form.controls.name.touched && form.controls.name.invalid) { <small class="form-error">اسم المخطط مطلوب</small> }</label>
            <label class="form-field"><span class="form-label">تاريخ المخطط</span><input type="date" formControlName="drawingDate"></label>
            @if (orgWide() && !drawing()) {
              <label class="form-field"><span class="form-label">القسم المُصدِر</span>
                <select formControlName="departmentId">
                  <option [ngValue]="0">— قسمي —</option>
                  @for (d of project().departments; track d.departmentId) { <option [ngValue]="d.departmentId">{{ d.departmentName }}</option> }
                </select></label>
            }
            <label class="form-field"><span class="form-label">المكتب <small class="hint">(اختياري)</small></span>
              <select formControlName="officeId">
                <option [ngValue]="0">— بلا —</option>
                @for (o of offices(); track o.id) { <option [ngValue]="o.id">{{ o.name }}</option> }
              </select></label>
            @if (!isArchitectural()) {
              <label class="form-field full"><span class="form-label">مبني على النسخة المعمارية المعتمدة</span>
                <select formControlName="basedOnVersionId">
                  <option [ngValue]="0" disabled>اختر…</option>
                  @for (b of basis(); track b.id) { <option [ngValue]="b.id">{{ b.label }}</option> }
                </select>
                @if (!basis().length) { <small class="hint">لا نسخة معمارية معتمدة بعد: تُعتمد النسخة بإصدار CDA لها.</small> }</label>
            }
            @if (drawing()) {
              <label class="form-field"><span class="form-label">الحالة</span>
                <select formControlName="status"><option [ngValue]="1">قيد الإعداد</option><option [ngValue]="2">بانتظار المراجعة</option></select>
                @if (isArchitectural()) { <small class="hint">المعماري تُرسل نسخه للاعتماد بإصدار CDA.</small> }</label>
            }
            <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="2000"></textarea></label>
          </div>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid || (!isArchitectural() && !form.controls.basedOnVersionId.value)" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyDrawingFormDialog implements OnInit {
  private service = inject(StudyDrawingsService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  project = input.required<StudyProject>();
  /** null = مخطط جديد */
  drawing = input<StudyDrawing | null>(null);
  /** النسخ المعمارية المعتمدة في المشروع */
  basis = input<BasisOption[]>([]);
  saved = output<StudyDrawing>();
  closed = output<void>();

  kinds = DRAWING_KINDS;
  saving = signal(false);
  error = signal('');
  orgWide = computed(() => this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));

  form = this.fb.nonNullable.group({
    kind: [1 as DrawingKind],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    drawingNumber: ['', [Validators.required, Validators.maxLength(50)]],
    drawingDate: [localDateInput(), Validators.required],
    description: [''],
    departmentId: [0],
    officeId: [0],
    basedOnVersionId: [0],
    status: [1 as 1 | 2]
  });

  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  isArchitectural = computed(() => (this.values().kind ?? 1) === 1);
  /** مكاتب القسم المُصدِر (المختار للمؤسسة، وإلا مكاتب كل الأقسام المشاركة) */
  offices = computed(() => {
    const departments = this.project().departments;
    const chosen = this.values().departmentId;
    return (chosen ? departments.filter(d => d.departmentId === chosen) : departments).flatMap(d => d.offices);
  });

  ngOnInit() {
    const d = this.drawing();
    if (!d) return;
    this.form.patchValue({
      kind: d.kind, name: d.name, drawingNumber: d.drawingNumber, drawingDate: dateOnly(d.drawingDate), description: d.description ?? '',
      officeId: d.officeId ?? 0, basedOnVersionId: d.basedOnVersionId ?? 0, status: d.status === 2 ? 2 : 1
    });
    this.form.controls.kind.disable();
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const d = this.drawing();
    if (v.kind !== 1 && !v.basedOnVersionId) return;
    const body: StudyDrawingInput = {
      projectId: this.project().id, kind: v.kind, name: v.name.trim(), drawingNumber: v.drawingNumber.trim(), drawingDate: v.drawingDate,
      description: optional(v.description), officeId: v.officeId || null,
      basedOnVersionId: v.kind === 1 ? null : v.basedOnVersionId,
      ...(d ? { status: v.status, rowVersion: d.rowVersion } : { departmentId: v.departmentId || null })
    };
    const call = d ? this.service.update(d.id, body) : this.service.create(body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
