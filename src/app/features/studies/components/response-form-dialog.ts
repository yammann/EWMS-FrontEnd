import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { localDateInput, qty } from '@core/utils/format';
import { integer } from '@core/utils/validators';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { BUILDING_TYPES, RECOMMENDATIONS, ResponseBuildingDetail, StudyEmployee, StudyResponse, StudyResponseInput } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { responseMoney, syrianEquivalent } from '../utils/response-pricing';

/** التكليف الذي يُكتب له الرد */
export interface ResponseParent { assignmentId: number; assignmentNumber: string; followingDepartmentName: string; branchId: number; }

const MAX_ROWS = 200;
const MAX_BUILDING_AREA = 9_999_999_999.99;
const hasTwoDecimals = (c: AbstractControl<number | null>) =>
  c.value == null || c.value === Number(c.value.toFixed(2)) ? null : { areaPrecision: true };
const validUsdRate = (c: AbstractControl<number | null>) => {
  const rate = c.value;
  return rate == null || (rate > 0 && rate < 1e12 && rate === Number(rate.toFixed(6))) ? null : { usdRate: true };
};

type BuildingDetailGroup = FormGroup<{ code: FormControl<string>; function: FormControl<string>; area: FormControl<number | null> }>;
type BuildingGroup = FormGroup<{
  included: FormControl<boolean>; buildingCount: FormControl<number | null>;
  buildingsArea: FormControl<number | null>; details: FormArray<BuildingDetailGroup>;
}>;
type CostRow = FormGroup<{ description: FormControl<string>; unit: FormControl<string>; quantity: FormControl<number>; unitPrice: FormControl<number | null> }>;

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
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss', './response-form-dialog.scss'],
  templateUrl: './response-form-dialog.html'
})
export class StudyResponseFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private lookups = inject(StudyLookupsService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private legacyCounts: (number | null)[] = [];

  parent = input.required<ResponseParent>();
  /** null = رد جديد */
  response = input<StudyResponse | null>(null);
  saved = output<StudyResponse>();
  closed = output<void>();

  recommendations = RECOMMENDATIONS;
  buildingTypes = BUILDING_TYPES;
  qty = qty;
  maxBuildingsPerType = MAX_ROWS;
  maxBuildingArea = MAX_BUILDING_AREA;
  saving = signal(false);
  error = signal('');
  missing = signal<string[]>([]);
  employees = signal<StudyEmployee[]>([]);
  individualBuildings = signal(false);
  legacyBuildingSummary = signal(false);
  costsInUsd = signal(true);
  costUnit = computed(() => this.costsInUsd() ? 'دولار' : 'ل.س');

  form = this.fb.nonNullable.group({
    responseDate: [localDateInput(), Validators.required],
    proposedManagerUserId: [0],
    recommendation: [1, Validators.required],
    siteArea: [null as number | null, Validators.min(0)],
    initialCost: [null as number | null, Validators.min(0)],
    usdToSypRate: [null as number | null, validUsdRate],
    /** [0] إعادة تأهيل، [1] إنشاء جديد — كعمودي النموذج الورقي */
    buildings: this.fb.array<BuildingGroup>([this.buildingGroup(), this.buildingGroup()]),
    costItems: this.fb.array<CostRow>([])
  });

  private costValues = toSignal(this.form.controls.costItems.valueChanges, { initialValue: [] });
  private usdRate = toSignal(this.form.controls.usdToSypRate.valueChanges, { initialValue: null });
  costTotal = computed(() => this.costValues().reduce((sum, c) => sum + (c.quantity ?? 0) * (c.unitPrice ?? 0), 0));

  ngOnInit() {
    const r = this.response();
    if (r) {
      this.costsInUsd.set(r.costsInUsd || (r.initialCost == null && !r.costItems.length));
      this.form.patchValue({
        responseDate: dateOnly(r.responseDate), proposedManagerUserId: r.proposedManagerUserId ?? 0,
        recommendation: r.recommendation, siteArea: r.siteArea, initialCost: r.initialCost,
        usdToSypRate: r.usdToSypRate ?? null
      });
      BUILDING_TYPES.forEach((t, i) => {
        const b = r.buildings.find(x => x.buildingType === t.value);
        if (!b) return;
        const group = this.form.controls.buildings.at(i);
        group.patchValue({ included: true, buildingCount: b.buildingCount, buildingsArea: b.buildingsArea }, { emitEvent: false });
        for (const detail of b.details ?? []) group.controls.details.push(this.buildingDetail(detail), { emitEvent: false });
      });
      if (r.buildings.every(b => !b.details?.length)) this.legacyCounts = this.buildingCounts();
      r.costItems.forEach(c => this.form.controls.costItems.push(this.costRow(c)));
    }
    this.syncBuildings();
    this.form.controls.buildings.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.syncBuildings());

    this.lookups.employees({ branchId: this.parent().branchId })
      .pipe(orEmpty(() => this.missing.update(m => [...m, 'موظفو الفرع (لاختيار مدير المشروع المقترح)'])))
      .subscribe(list => this.employees.set(list));
  }

  private buildingGroup(): BuildingGroup {
    return this.fb.nonNullable.group({
      included: [false],
      buildingCount: [0 as number | null, [Validators.required, Validators.min(0), integer]],
      buildingsArea: [0 as number | null, [Validators.min(0), Validators.max(MAX_BUILDING_AREA)]],
      details: this.fb.array<BuildingDetailGroup>([])
    });
  }

  private buildingDetail(detail?: ResponseBuildingDetail): BuildingDetailGroup {
    return this.fb.nonNullable.group({
      code: [detail?.code ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(50)]],
      function: [detail?.function ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)]],
      area: [detail?.area ?? null, [Validators.required, Validators.min(0.01), Validators.max(MAX_BUILDING_AREA), hasTwoDecimals]]
    });
  }

  private buildingCounts() {
    return this.form.controls.buildings.controls.map(({ controls: b }) => b.included.value ? b.buildingCount.value : null);
  }

  enterBuildingDetails() {
    this.legacyCounts = [];
    this.syncBuildings();
  }

  private syncBuildings() {
    const counts = this.buildingCounts();
    const multiple = counts.reduce<number>((sum, n) => sum + (n != null && Number.isInteger(n) && n > 0 ? n : 0), 0) > 1;
    if (!counts.every((count, i) => count === this.legacyCounts[i])) this.legacyCounts = [];
    const legacy = multiple && this.legacyCounts.length > 0;
    const wasDetailed = this.individualBuildings();
    this.legacyBuildingSummary.set(legacy);
    this.individualBuildings.set(multiple && !legacy);
    for (const { controls: b } of this.form.controls.buildings.controls) {
      const included = b.included.value;
      this.setEnabled(b.buildingCount, included);
      const count = this.visibleBuildingRows(b.buildingCount.value);
      if (wasDetailed && !multiple && included && b.buildingCount.value === 1) {
        const firstArea = b.details.controls[0]?.controls.area.value;
        if (firstArea != null) b.buildingsArea.setValue(firstArea, { emitEvent: false });
      }
      this.setEnabled(b.buildingsArea, included && !multiple);
      if (included) {
        while (b.details.length < count) b.details.push(this.buildingDetail(), { emitEvent: false });
      }
      b.details.controls.forEach((detail, i) => this.setEnabled(detail, included && i < count));
    }
  }

  private setEnabled(control: AbstractControl, enabled: boolean) {
    if (enabled && control.disabled) control.enable({ emitEvent: false });
    if (!enabled && control.enabled) control.disable({ emitEvent: false });
  }

  private visibleBuildingRows(count: number | null) {
    return this.individualBuildings() && count != null && Number.isInteger(count) && count > 0 && count <= MAX_ROWS ? count : 0;
  }

  buildingDetails(group: BuildingGroup) {
    return group.controls.details.controls.slice(0, this.visibleBuildingRows(group.controls.buildingCount.value));
  }

  buildingArea(group: BuildingGroup) {
    if (!this.individualBuildings()) return group.controls.buildingsArea.value ?? 0;
    const cents = this.buildingDetails(group).reduce((sum, row) => sum + Math.round((row.controls.area.value ?? 0) * 100), 0);
    return cents / 100;
  }

  buildingLimitsExceeded() {
    return this.individualBuildings() && this.form.controls.buildings.controls.some(group => group.controls.included.value &&
      ((group.controls.buildingCount.value ?? 0) > MAX_ROWS || this.buildingArea(group) > MAX_BUILDING_AREA));
  }

  private costRow(c?: { description: string; unit: string; quantity: number; unitPrice: number }): CostRow {
    return this.fb.nonNullable.group({
      description: [c?.description ?? '', [Validators.required, Validators.maxLength(500)]],
      unit: [c?.unit ?? '', [Validators.required, Validators.maxLength(30)]],
      quantity: [c?.quantity ?? 1, [Validators.required, Validators.min(0)]],
      unitPrice: [c?.unitPrice ?? null, [Validators.required, Validators.min(0)]]
    });
  }

  addCost() { if (this.form.controls.costItems.length < MAX_ROWS) this.form.controls.costItems.push(this.costRow()); }
  remove(array: FormArray, index: number) { array.removeAt(index); array.markAsDirty(); }
  rowTotal(row: CostRow) { const v = row.getRawValue(); return (v.quantity || 0) * (v.unitPrice || 0); }
  costMoney(value: number) { return responseMoney(value, this.costsInUsd()); }

  equivalent(value: number | null) {
    return this.costsInUsd() && this.form.controls.usdToSypRate.valid ? syrianEquivalent(value, this.usdRate()) : '';
  }

  enableUsdPricing() {
    const { initialCost, costItems } = this.form.controls;
    if (initialCost.value != null) initialCost.addValidators(Validators.required);
    initialCost.setValue(null);
    for (const row of costItems.controls) row.controls.unitPrice.setValue(null);
    this.costsInUsd.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.buildingLimitsExceeded() || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.response();
    const body: StudyResponseInput = {
      assignmentId: this.parent().assignmentId,
      responseDate: v.responseDate,
      proposedManagerUserId: v.proposedManagerUserId || null,
      recommendation: v.recommendation,
      siteArea: v.siteArea, initialCost: v.initialCost,
      costsInUsd: this.costsInUsd(), usdToSypRate: this.costsInUsd() ? v.usdToSypRate : null,
      buildings: this.form.controls.buildings.controls.flatMap((group, i) => {
        if (!group.controls.included.value) return [];
        const details = this.buildingDetails(group).map(row => {
          const { code, function: buildingFunction, area } = row.getRawValue();
          return { code: code.trim(), function: buildingFunction.trim(), area: area! };
        });
        return [{
          buildingType: BUILDING_TYPES[i].value, buildingCount: group.controls.buildingCount.value ?? 0,
          buildingsArea: this.buildingArea(group), details
        }];
      }),
      costItems: v.costItems.map(c => ({ description: c.description.trim(), unit: c.unit.trim(), quantity: c.quantity, unitPrice: c.unitPrice! })),
      rowVersion: r?.rowVersion ?? null
    };
    const call = r ? this.service.update('responses', r.id, body) : this.service.create('responses', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
