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
type BuildingType = typeof BUILDING_TYPES[number]['value'];
type PricedBuilding = ResponseBuildingDetail & { buildingType: BuildingType; unitPrice: number | null };
type PricedBuildingGroup = FormGroup<{
  buildingType: FormControl<BuildingType>; code: FormControl<string>; function: FormControl<string>;
  area: FormControl<number | null>; unitPrice: FormControl<number | null>;
}>;

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
  private showSingleBuildingDetails = false;
  private legacyCostAssignments = new Map<CostRow, BuildingDetailGroup>();

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
  legacyLayout = signal(false);
  mergeMessage = signal('');
  maxPricedBuildings = MAX_ROWS;
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
    costItems: this.fb.array<CostRow>([]),
    pricedBuildings: this.fb.array<PricedBuildingGroup>([])
  });

  private costValues = toSignal(this.form.controls.costItems.valueChanges, { initialValue: [] });
  private pricedBuildings = toSignal(this.form.controls.pricedBuildings.valueChanges, { initialValue: [] });
  private usdRate = toSignal(this.form.controls.usdToSypRate.valueChanges, { initialValue: null });
  costTotal = computed(() => this.legacyLayout()
    ? this.costValues().reduce((sum, c) => sum + (c.quantity ?? 0) * (c.unitPrice ?? 0), 0)
    : this.pricedBuildings().reduce((sum, b) => sum + (b.area ?? 0) * (b.unitPrice ?? 0), 0));

  ngOnInit() {
    const r = this.response();
    if (r) {
      this.showSingleBuildingDetails = r.buildings.some(b => !!b.details?.length);
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
    this.legacyLayout.set(!!(r?.buildings.length || r?.costItems.length));
    if (this.legacyLayout()) this.mergeLegacyBuildings(true);

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

  addBuilding(building?: PricedBuilding) {
    const rows = this.form.controls.pricedBuildings;
    if (rows.length >= MAX_ROWS) return;
    const { code, function: buildingFunction, area } = this.buildingDetail(building).controls;
    rows.push(this.fb.nonNullable.group({
      buildingType: [building?.buildingType ?? BUILDING_TYPES[0].value],
      code, function: buildingFunction, area,
      unitPrice: [building?.unitPrice ?? null, [Validators.required, Validators.min(0)]]
    }));
  }

  buildingSummary(type: BuildingType) {
    const rows = this.pricedBuildings().filter(row => row.buildingType === type);
    const area = rows.reduce((sum, row) => sum + Math.round((row.area ?? 0) * 100), 0) / 100;
    return { count: rows.length, area };
  }

  buildingCost(row: PricedBuildingGroup) {
    const { area, unitPrice } = row.getRawValue();
    return (area ?? 0) * (unitPrice ?? 0);
  }

  private buildingDescription(building: Pick<PricedBuilding, 'buildingType' | 'code' | 'function'>) {
    const type = this.buildingTypeLabel(building.buildingType);
    return `${type} — ${building.code.trim()} — ${building.function.trim()}`;
  }

  buildingTypeLabel(type: BuildingType) {
    return BUILDING_TYPES.find(option => option.value === type)?.label ?? '';
  }

  legacyBuildingChoices() {
    return this.form.controls.buildings.controls.flatMap((group, i) => group.controls.included.value
      ? this.buildingDetails(group).map((row, index) => ({ row, index, ...row.getRawValue(), buildingType: BUILDING_TYPES[i].value }))
      : []);
  }

  legacyCostAssignment(cost: CostRow) {
    return this.legacyBuildingChoices().findIndex(building => building.row === this.legacyCostAssignments.get(cost));
  }

  assignLegacyCost(cost: CostRow, index: number) {
    const choice = this.legacyBuildingChoices()[index];
    if (choice) this.legacyCostAssignments.set(cost, choice.row);
    else this.legacyCostAssignments.delete(cost);
  }

  mergeLegacyBuildings(onOpen = false) {
    const { buildings, costItems } = this.form.controls;
    const details = this.legacyBuildingChoices();
    const count = this.buildingCounts().reduce<number>((sum, n) => sum + (n ?? 0), 0);
    const costs = costItems.getRawValue();
    const matches = details.map(building => costs.filter((cost, i) => {
      const assigned = this.legacyCostAssignments.get(costItems.at(i));
      return cost.quantity === building.area && /^(م²|م2|متر مربع)$/.test(cost.unit.trim()) &&
        (assigned ? assigned === building.row :
          [this.buildingDescription(building), building.code.trim(), building.function.trim(),
            `${building.code.trim()} — ${building.function.trim()}`].includes(cost.description.trim()));
    }));
    // Unified saves write the cost rows in the same type and detail order as the building rows.
    const ordered = details.length === costs.length && details.every((building, i) =>
      matches[i].includes(costs[i]) && costs[i].description === this.buildingDescription(building) && costs[i].unit === 'م²');
    if (onOpen && !ordered) {
      this.mergeMessage.set('راجع تفاصيل المباني وبنود التكلفة قبل دمجها.');
      return;
    }
    const matched = ordered && this.legacyCostAssignments.size === 0 ? costs :
      matches.map(items => items.length === 1 ? items[0] : undefined);
    if (buildings.invalid || costItems.invalid || details.length !== count || details.length > MAX_ROWS ||
        details.some(row => row.area == null) || (costs.length > 0 &&
          (matched.some(cost => !cost) || new Set(matched).size !== costs.length || details.length !== costs.length)) ||
        (!details.length && buildings.controls.some(group => group.controls.included.value))) {
      this.mergeMessage.set('لإتمام الدمج، طابق كل بند مع مبنى واحد بوحدة المتر المربع وبكمية تساوي مساحة المبنى.');
      return;
    }

    details.forEach(({ buildingType, code, function: buildingFunction, area }, i) =>
      this.addBuilding({ buildingType, code, function: buildingFunction, area: area!, unitPrice: matched[i]?.unitPrice ?? null }));
    buildings.disable({ emitEvent: false });
    costItems.disable({ emitEvent: false });
    this.legacyLayout.set(false);
    this.mergeMessage.set('');
  }

  private buildingCounts() {
    return this.form.controls.buildings.controls.map(({ controls: b }) => b.included.value ? b.buildingCount.value : null);
  }

  enterBuildingDetails() {
    this.legacyCounts = [];
    this.showSingleBuildingDetails = true;
    this.syncBuildings();
  }

  private syncBuildings() {
    const counts = this.buildingCounts();
    const multiple = counts.reduce<number>((sum, n) => sum + (n != null && Number.isInteger(n) && n > 0 ? n : 0), 0) > 1;
    if (!counts.every((count, i) => count === this.legacyCounts[i])) this.legacyCounts = [];
    const legacy = multiple && this.legacyCounts.length > 0;
    const wasDetailed = this.individualBuildings();
    this.legacyBuildingSummary.set(legacy);
    const detailed = (multiple || this.showSingleBuildingDetails) && !legacy;
    this.individualBuildings.set(detailed);
    for (const { controls: b } of this.form.controls.buildings.controls) {
      const included = b.included.value;
      this.setEnabled(b.buildingCount, included);
      const count = this.visibleBuildingRows(b.buildingCount.value);
      if (wasDetailed && !detailed && included && b.buildingCount.value === 1) {
        const firstArea = b.details.controls[0]?.controls.area.value;
        if (firstArea != null) b.buildingsArea.setValue(firstArea, { emitEvent: false });
      }
      this.setEnabled(b.buildingsArea, included && !detailed && !legacy);
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
    if (!this.legacyLayout()) return BUILDING_TYPES.some(type => this.buildingSummary(type.value).area > MAX_BUILDING_AREA);
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
    const { initialCost, costItems, pricedBuildings } = this.form.controls;
    if (initialCost.value != null) initialCost.addValidators(Validators.required);
    initialCost.setValue(null);
    for (const row of costItems.controls) row.controls.unitPrice.setValue(null);
    for (const row of pricedBuildings.controls) row.controls.unitPrice.setValue(null);
    this.costsInUsd.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.buildingLimitsExceeded() || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.response();
    const pricedBuildings = BUILDING_TYPES.flatMap(type => v.pricedBuildings.filter(row => row.buildingType === type.value));
    const body: StudyResponseInput = {
      assignmentId: this.parent().assignmentId,
      responseDate: v.responseDate,
      proposedManagerUserId: v.proposedManagerUserId || null,
      recommendation: v.recommendation,
      siteArea: v.siteArea, initialCost: v.initialCost,
      costsInUsd: this.costsInUsd(), usdToSypRate: this.costsInUsd() ? v.usdToSypRate : null,
      buildings: this.legacyLayout() ? this.form.controls.buildings.controls.flatMap((group, i) => {
        if (!group.controls.included.value) return [];
        const details = this.buildingDetails(group).map(row => {
          const { code, function: buildingFunction, area } = row.getRawValue();
          return { code: code.trim(), function: buildingFunction.trim(), area: area! };
        });
        return [{
          buildingType: BUILDING_TYPES[i].value, buildingCount: group.controls.buildingCount.value ?? 0,
          buildingsArea: this.buildingArea(group), details
        }];
      }) : BUILDING_TYPES.flatMap(type => {
        const details = pricedBuildings.filter(row => row.buildingType === type.value)
          .map(row => ({ code: row.code.trim(), function: row.function.trim(), area: row.area! }));
        const { count, area } = this.buildingSummary(type.value);
        return count ? [{ buildingType: type.value, buildingCount: count, buildingsArea: area, details }] : [];
      }),
      costItems: this.legacyLayout()
        ? v.costItems.map(c => ({ description: c.description.trim(), unit: c.unit.trim(), quantity: c.quantity, unitPrice: c.unitPrice! }))
        : pricedBuildings.map(row => ({ description: this.buildingDescription(row), unit: 'م²', quantity: row.area!, unitPrice: row.unitPrice! })),
      rowVersion: r?.rowVersion ?? null
    };
    const call = r ? this.service.update('responses', r.id, body) : this.service.create('responses', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
