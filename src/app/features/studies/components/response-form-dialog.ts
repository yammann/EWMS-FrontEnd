import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { localDateInput, money } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { BUILDING_TYPES, RECOMMENDATIONS, StudyEmployee, StudyResponse, StudyResponseInput } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';

/** التكليف الذي يُكتب له الرد */
export interface ResponseParent { assignmentId: number; assignmentNumber: string; followingDepartmentName: string; branchId: number; }

const MAX_ROWS = 200;

type BuildingGroup = FormGroup<{ included: FormControl<boolean>; buildingCount: FormControl<number>; buildingsArea: FormControl<number> }>;
type CostRow = FormGroup<{ description: FormControl<string>; unit: FormControl<string>; quantity: FormControl<number>; unitPrice: FormControl<number> }>;

/**
 * إشعار الرد — جزء «القسم المتابع» من النموذج الورقي: تاريخ الرد، مدير المشروع المقترح، التوصية،
 * المباني بنوعيها (العدد والمساحة)، مساحة الموقع العام، التكلفة المبدئية وجدولها التفصيلي.
 * جزء «التخطيط وإدارة المشاريع» (المدة والكوادر والموارد اللوجستية) له نافذته (StudyResponsePlanningDialog)
 * ويحفظه صاحبه بعد توقيع القسم المتابع. الجدولان يُستبدلان كاملين عند كل حفظ.
 */
@Component({
  selector: 'app-study-response-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions, Icon],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  templateUrl: './response-form-dialog.html'
})
export class StudyResponseFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private lookups = inject(StudyLookupsService);
  private fb = inject(FormBuilder);

  parent = input.required<ResponseParent>();
  /** null = رد جديد */
  response = input<StudyResponse | null>(null);
  saved = output<StudyResponse>();
  closed = output<void>();

  recommendations = RECOMMENDATIONS;
  buildingTypes = BUILDING_TYPES;
  money = money;
  saving = signal(false);
  error = signal('');
  missing = signal<string[]>([]);
  employees = signal<StudyEmployee[]>([]);

  form = this.fb.nonNullable.group({
    responseDate: [localDateInput(), Validators.required],
    proposedManagerUserId: [0],
    recommendation: [1, Validators.required],
    siteArea: [null as number | null, Validators.min(0)],
    initialCost: [null as number | null, Validators.min(0)],
    /** [0] إعادة تأهيل، [1] إنشاء جديد — كعمودي النموذج الورقي */
    buildings: this.fb.array<BuildingGroup>([this.buildingGroup(), this.buildingGroup()]),
    costItems: this.fb.array<CostRow>([])
  });

  private costValues = toSignal(this.form.controls.costItems.valueChanges, { initialValue: [] });
  costTotal = computed(() => this.costValues().reduce((sum, c) => sum + (c.quantity ?? 0) * (c.unitPrice ?? 0), 0));

  ngOnInit() {
    const r = this.response();
    if (r) {
      this.form.patchValue({
        responseDate: dateOnly(r.responseDate), proposedManagerUserId: r.proposedManagerUserId ?? 0,
        recommendation: r.recommendation, siteArea: r.siteArea, initialCost: r.initialCost
      });
      BUILDING_TYPES.forEach((t, i) => {
        const b = r.buildings.find(x => x.buildingType === t.value);
        if (b) this.form.controls.buildings.at(i).setValue({ included: true, buildingCount: b.buildingCount, buildingsArea: b.buildingsArea });
      });
      r.costItems.forEach(c => this.form.controls.costItems.push(this.costRow(c)));
    }

    this.lookups.employees({ branchId: this.parent().branchId })
      .pipe(orEmpty(() => this.missing.update(m => [...m, 'موظفو الفرع (لاختيار مدير المشروع المقترح)'])))
      .subscribe(list => this.employees.set(list));
  }

  private buildingGroup(): BuildingGroup {
    return this.fb.nonNullable.group({ included: [false], buildingCount: [0, Validators.min(0)], buildingsArea: [0, Validators.min(0)] });
  }

  private costRow(c?: { description: string; unit: string; quantity: number; unitPrice: number }): CostRow {
    return this.fb.nonNullable.group({
      description: [c?.description ?? '', [Validators.required, Validators.maxLength(500)]],
      unit: [c?.unit ?? '', [Validators.required, Validators.maxLength(30)]],
      quantity: [c?.quantity ?? 1, [Validators.required, Validators.min(0)]],
      unitPrice: [c?.unitPrice ?? 0, [Validators.required, Validators.min(0)]]
    });
  }

  addCost() { if (this.form.controls.costItems.length < MAX_ROWS) this.form.controls.costItems.push(this.costRow()); }
  remove(array: FormArray, index: number) { array.removeAt(index); array.markAsDirty(); }
  rowTotal(row: CostRow) { const v = row.getRawValue(); return (v.quantity || 0) * (v.unitPrice || 0); }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.response();
    const body: StudyResponseInput = {
      assignmentId: this.parent().assignmentId,
      responseDate: v.responseDate,
      proposedManagerUserId: v.proposedManagerUserId || null,
      recommendation: v.recommendation,
      siteArea: v.siteArea, initialCost: v.initialCost,
      buildings: v.buildings
        .map((b, i) => ({ ...b, buildingType: BUILDING_TYPES[i].value }))
        .filter(b => b.included)
        .map(b => ({ buildingType: b.buildingType, buildingCount: b.buildingCount, buildingsArea: b.buildingsArea })),
      costItems: v.costItems.map(c => ({ description: c.description.trim(), unit: c.unit.trim(), quantity: c.quantity, unitPrice: c.unitPrice })),
      rowVersion: r?.rowVersion ?? null
    };
    const call = r ? this.service.update('responses', r.id, body) : this.service.create('responses', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
