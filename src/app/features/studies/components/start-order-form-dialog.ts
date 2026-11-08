import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { orEmpty } from '@core/http/or-empty';
import { Department } from '@core/models/ewms.models';
import { LookupsService } from '@core/services/lookups.service';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { StudyEmployee, StudyLookup, StudyStartOrder, StudyStartOrderInput } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { ItemRow, itemRow, itemValue } from '../utils/form-rows';

/** الرد المعتمد الذي يُصدر له أمر البدء */
export interface StartOrderParent { responseId: number; assignmentNumber: string; branchId: number; proposedManagerUserId: number | null; }

type EngineerRow = FormGroup<{ engineerUserId: FormControl<number>; disciplineId: FormControl<number> }>;

const deadlineAfterStart = (g: AbstractControl): ValidationErrors | null => {
  const { studyStartDate, studyDeadline } = g.getRawValue() as { studyStartDate: string; studyDeadline: string };
  return studyStartDate && studyDeadline && studyDeadline < studyStartDate ? { deadline: true } : null;
};

/**
 * أمر بدء دراسة المشروع (PIO) — حقول النموذج الورقي: القسم المختص، مدير المشروع، تاريخ البدء والحد الأقصى للإنهاء،
 * الموارد والكوادر الهندسية المخصصة. يوقّعه رئيس القسم المختص ثم رئيس الفرع.
 */
@Component({
  selector: 'app-study-start-order-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions, Icon],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  templateUrl: './start-order-form-dialog.html'
})
export class StudyStartOrderFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private studyLookups = inject(StudyLookupsService);
  private lookups = inject(LookupsService);
  private fb = inject(FormBuilder);

  parent = input.required<StartOrderParent>();
  /** null = أمر جديد */
  order = input<StudyStartOrder | null>(null);
  saved = output<StudyStartOrder>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  missing = signal<string[]>([]);
  departments = signal<Department[]>([]);
  employees = signal<StudyEmployee[]>([]);
  disciplines = signal<StudyLookup[]>([]);

  form = this.fb.nonNullable.group({
    competentDepartmentId: [0, Validators.min(1)],
    projectManagerUserId: [0, Validators.min(1)],
    orderDate: [localDateInput(), Validators.required],
    studyStartDate: [localDateInput(), Validators.required],
    studyDeadline: ['', Validators.required],
    engineers: this.fb.array<EngineerRow>([]),
    resources: this.fb.array<ItemRow>([])
  }, { validators: deadlineAfterStart });

  private engineerValues = toSignal(this.form.controls.engineers.valueChanges, { initialValue: [] });
  /** مهندس مكرر في الأمر (الخادم يرفضه) */
  duplicateEngineer = computed(() => {
    const ids = this.engineerValues().map(e => e.engineerUserId ?? 0).filter(Boolean);
    return new Set(ids).size !== ids.length;
  });

  ngOnInit() {
    const o = this.order();
    if (o) {
      this.form.patchValue({
        competentDepartmentId: o.competentDepartmentId, projectManagerUserId: o.projectManagerUserId,
        orderDate: dateOnly(o.orderDate), studyStartDate: dateOnly(o.studyStartDate), studyDeadline: dateOnly(o.studyDeadline)
      });
      o.engineers.forEach(e => this.form.controls.engineers.push(this.engineerRow(e.engineerUserId, e.disciplineId)));
      o.resources.forEach(r => this.form.controls.resources.push(itemRow(this.fb, r)));
    } else if (this.parent().proposedManagerUserId) {
      // المدير الذي اقترحه الرد: يُقترح هنا ويُغيَّر إن لزم
      this.form.controls.projectManagerUserId.setValue(this.parent().proposedManagerUserId!);
    }

    const branchId = this.parent().branchId;
    this.lookups.departments().pipe(
      map(list => list.filter(d => d.branchId === branchId)),
      orEmpty(() => this.addMissing('الأقسام (تحتاج «عرض الأقسام»)'))
    ).subscribe(list => this.departments.set(list));
    this.studyLookups.employees({ branchId }).pipe(orEmpty(() => this.addMissing('موظفو الفرع')))
      .subscribe(list => this.employees.set(list));
    this.studyLookups.lookup('disciplines', true).pipe(orEmpty(() => this.addMissing('الاختصاصات الهندسية (تحتاج «عرض قوائم الدراسات»)')))
      .subscribe(list => {
        const kept = (o?.engineers ?? []).filter(e => !list.some(d => d.id === e.disciplineId))
          .map(e => ({ id: e.disciplineId, name: e.disciplineName, isActive: false }));
        this.disciplines.set([...list, ...kept.filter((d, i) => kept.findIndex(x => x.id === d.id) === i)]);
      });
  }

  private addMissing(what: string) { this.missing.update(m => [...m, what]); }

  private engineerRow(engineerUserId = 0, disciplineId = 0): EngineerRow {
    return this.fb.nonNullable.group({ engineerUserId: [engineerUserId, Validators.min(1)], disciplineId: [disciplineId, Validators.min(1)] });
  }

  addEngineer() { if (this.form.controls.engineers.length < 100) this.form.controls.engineers.push(this.engineerRow()); }
  addResource() { if (this.form.controls.resources.length < 200) this.form.controls.resources.push(itemRow(this.fb)); }
  remove(array: FormArray, index: number) { array.removeAt(index); array.markAsDirty(); }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicateEngineer() || this.saving()) return;
    const v = this.form.getRawValue();
    const o = this.order();
    const body: StudyStartOrderInput = {
      responseId: this.parent().responseId,
      competentDepartmentId: v.competentDepartmentId, projectManagerUserId: v.projectManagerUserId,
      orderDate: v.orderDate, studyStartDate: v.studyStartDate, studyDeadline: v.studyDeadline,
      engineers: v.engineers.map(e => ({ engineerUserId: e.engineerUserId, disciplineId: e.disciplineId })),
      resources: this.form.controls.resources.controls.map(itemValue),
      rowVersion: o?.rowVersion ?? null
    };
    const call = o ? this.service.update('startOrders', o.id, body) : this.service.create('startOrders', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
