import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { integer } from '@core/utils/validators';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyLookup, StudyResponse, StudyResponsePlanningInput } from '../data-access/studies.models';
import { ItemRow, itemRow, itemValue } from '../utils/form-rows';

const MAX_ROWS = 200;
type StaffRow = FormGroup<{ disciplineId: FormControl<number>; staffCount: FormControl<number> }>;

/**
 * جزء «التخطيط وإدارة المشاريع» من إشعار الرد: تقدير المدة، الكوادر الهندسية المقترحة، والموارد اللوجستية.
 * يحفظه من يملك EditStudyResponsePlanning بعد توقيع القسم المتابع وقبل توقيع التخطيط (علم canEditPlanningPart)،
 * ولا يمسّ جزء القسم المتابع. الجداول تُرسل كاملة وتُستبدل. حقوله اختيارية دائماً (حتى مع التوصية «غير متاح»).
 */
@Component({
  selector: 'app-study-response-planning-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions, Icon],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  template: `
    <app-modal size="lg" heading="التخطيط وإدارة المشاريع" [subheading]="'إشعار الرد ' + response().responseNumber" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (missing()) { <p class="alert alert-warning" role="status">{{ missing() }}</p> }
          <p class="context">جزء القسم المتابع مقفل لصاحبه، وهذا الجزء لك وحدك حتى توقّع.</p>

          <section class="form-section">
            <h3>تقدير المدة اللازمة لإعداد الدراسة</h3>
            <div class="form-grid-3">
              <label class="form-field"><span class="form-label">المدة (يوم تقويمي)</span>
                <input type="number" formControlName="requiredDays" min="1" max="3650" step="1">
                @if (form.controls.requiredDays.invalid) { <small class="form-error">بين 1 و3650 يوماً</small> }</label>
            </div>
          </section>

          <section class="form-section" formArrayName="staffEstimates">
            <h3>الكوادر الهندسية المقترحة لإعداد الدراسة</h3>
            @if (!form.controls.staffEstimates.length) { <p class="rows-empty">لا كوادر بعد.</p> }
            <div class="rows">
              @for (s of form.controls.staffEstimates.controls; track s; let i = $index) {
                <div class="row staff-row" [formGroupName]="i">
                  <label class="form-field"><span class="form-label">الاختصاص</span>
                    <select formControlName="disciplineId">
                      <option [ngValue]="0" disabled>اختر…</option>
                      @for (d of disciplines(); track d.id) { <option [ngValue]="d.id">{{ d.name }}</option> }
                    </select></label>
                  <label class="form-field"><span class="form-label">العدد</span><input type="number" formControlName="staffCount" min="0" max="1000" step="1"></label>
                  <button type="button" class="icon-btn row-remove" aria-label="حذف الاختصاص" (click)="remove(form.controls.staffEstimates, i)"><app-icon name="trash" [size]="16" /></button>
                </div>
              }
            </div>
            @if (duplicateStaff()) { <small class="form-error">كل اختصاص مرة واحدة فقط</small> }
            <div class="rows-foot"><button type="button" class="btn btn-ghost btn-sm" (click)="addStaff()" [disabled]="!disciplines().length">+ اختصاص</button></div>
          </section>

          <section class="form-section" formArrayName="logisticItems">
            <h3>تقدير الموارد اللوجستية اللازمة لإعداد الدراسة</h3>
            @if (!form.controls.logisticItems.length) { <p class="rows-empty">لا موارد بعد.</p> }
            <div class="rows">
              @for (l of form.controls.logisticItems.controls; track l; let i = $index) {
                <div class="row item-row" [formGroupName]="i">
                  <label class="form-field"><span class="form-label">المورد</span><input formControlName="item" maxlength="200"></label>
                  <label class="form-field"><span class="form-label">الكمية</span><input type="number" formControlName="quantity" min="0" step="any"></label>
                  <label class="form-field"><span class="form-label">ملاحظة</span><input formControlName="note" maxlength="500"></label>
                  <button type="button" class="icon-btn row-remove" aria-label="حذف المورد" (click)="remove(form.controls.logisticItems, i)"><app-icon name="trash" [size]="16" /></button>
                </div>
              }
            </div>
            <div class="rows-foot"><button type="button" class="btn btn-ghost btn-sm" (click)="addLogistic()">+ مورد</button></div>
          </section>
        </div>
        <app-form-actions [busy]="saving()" [disabled]="form.invalid || duplicateStaff()" label="حفظ" busyLabel="جارٍ الحفظ…" (dismissed)="closed.emit()" />
      </form>
    </app-modal>
  `
})
export class StudyResponsePlanningDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private lookups = inject(StudyLookupsService);
  private fb = inject(FormBuilder);

  response = input.required<StudyResponse>();
  saved = output<StudyResponse>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  missing = signal('');
  disciplines = signal<StudyLookup[]>([]);

  form = this.fb.nonNullable.group({
    requiredDays: [null as number | null, [Validators.min(1), Validators.max(3650), integer]],
    staffEstimates: this.fb.array<StaffRow>([]),
    logisticItems: this.fb.array<ItemRow>([])
  });

  private staffValues = toSignal(this.form.controls.staffEstimates.valueChanges, { initialValue: [] });
  /** اختصاص مكرر في الكوادر (الخادم يرفضه) */
  duplicateStaff = computed(() => {
    const ids = this.staffValues().map(s => s.disciplineId ?? 0).filter(Boolean);
    return new Set(ids).size !== ids.length;
  });

  ngOnInit() {
    const r = this.response();
    this.form.patchValue({ requiredDays: r.requiredDays });
    r.staffEstimates.forEach(s => this.form.controls.staffEstimates.push(this.staffRow(s.disciplineId, s.staffCount)));
    r.logisticItems.forEach(i => this.form.controls.logisticItems.push(itemRow(this.fb, i)));

    this.lookups.lookup('disciplines', true)
      .pipe(orEmpty(() => this.missing.set('لم تُحمَّل الاختصاصات الهندسية (تحتاج «عرض قوائم الدراسات»).')))
      .subscribe(list => {
        // اختصاص عُطّل بعد حفظ الرد يبقى ظاهراً في سطره
        const kept = r.staffEstimates.filter(s => !list.some(d => d.id === s.disciplineId))
          .map(s => ({ id: s.disciplineId, name: s.disciplineName, isActive: false }));
        this.disciplines.set([...list, ...kept]);
      });
  }

  private staffRow(disciplineId = 0, staffCount = 1): StaffRow {
    return this.fb.nonNullable.group({
      disciplineId: [disciplineId, Validators.min(1)],
      staffCount: [staffCount, [Validators.required, Validators.min(0), Validators.max(1000), integer]]
    });
  }

  addStaff() { this.form.controls.staffEstimates.push(this.staffRow()); }
  addLogistic() { if (this.form.controls.logisticItems.length < MAX_ROWS) this.form.controls.logisticItems.push(itemRow(this.fb)); }
  remove(array: FormArray, index: number) { array.removeAt(index); array.markAsDirty(); }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicateStaff() || this.saving()) return;
    const v = this.form.getRawValue();
    const body: StudyResponsePlanningInput = {
      requiredDays: v.requiredDays,
      staffEstimates: v.staffEstimates.map(s => ({ disciplineId: s.disciplineId, staffCount: s.staffCount })),
      logisticItems: this.form.controls.logisticItems.controls.map(itemValue),
      rowVersion: this.response().rowVersion
    };
    trackRequest(this.service.updateResponsePlanning(this.response().id, body), this.saving, this.error, saved => this.saved.emit(saved));
  }
}
