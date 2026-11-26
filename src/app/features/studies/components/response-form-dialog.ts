import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { orEmpty } from '@core/http/or-empty';
import { localDateInput, qty } from '@core/utils/format';
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
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

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

type BuildingType = typeof BUILDING_TYPES[number]['value'];
type PricedBuilding = ResponseBuildingDetail & { buildingType: BuildingType; unitPrice: number | null };
type PricedBuildingGroup = FormGroup<{
  buildingType: FormControl<BuildingType>; code: FormControl<string>; function: FormControl<string>;
  area: FormControl<number | null>; unitPrice: FormControl<number | null>;
}>;

/**
 * إشعار الرد — جزء «القسم المتابع» من النموذج الورقي: تاريخ الرد، مدير المشروع المقترح، التوصية،
 * مساحة الموقع العام، التكلفة المبدئية، والمباني: سطر لكل مبنى (نوعه، رمزه، وظيفته، مساحته، سعر المتر).
 * يُرسل الشكل الموحّد: لكل نوع عدد المباني ومساحتها وتفاصيلها، وبند تكلفة لكل مبنى بالترتيب نفسه
 * (الوصف «النوع — الرمز — الوظيفة»، الوحدة م²، الكمية = المساحة). الجدولان يُستبدلان كاملين عند كل حفظ.
 * جزء «التخطيط وإدارة المشاريع» (المدة والكوادر والموارد اللوجستية) له نافذته (StudyResponsePlanningDialog)
 * ويحفظه صاحبه بعد توقيع القسم المتابع.
 */
@Component({
  selector: 'app-study-response-form-dialog',
  imports: [FormActions, SearchSelect, SelectOption, ReactiveFormsModule, Modal, Alert, Icon],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss', './response-form-dialog.scss'],
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
  qty = qty;
  maxBuildingArea = MAX_BUILDING_AREA;
  maxPricedBuildings = MAX_ROWS;
  saving = signal(false);
  error = signal('');
  missing = signal<string[]>([]);
  employees = signal<StudyEmployee[]>([]);
  costsInUsd = signal(true);
  costUnit = computed(() => this.costsInUsd() ? 'دولار' : 'ل.س');
  /**
   * رد محفوظ لا تقابل بنودُ تكلفته مبانيه واحداً لواحد، أو فيه مبانٍ بلا تفاصيل (بيانات لم تُحوَّل إلى الشكل الموحّد):
   * تظهر المباني المفصّلة بلا سعر ويُنبَّه المستخدم، بدل أن يُحفظ فوقها بصمت.
   */
  incomplete = signal(false);

  form = this.fb.nonNullable.group({
    responseDate: [localDateInput(), Validators.required],
    proposedManagerUserId: [0],
    recommendation: [1, Validators.required],
    siteArea: [null as number | null, Validators.min(0)],
    initialCost: [null as number | null, Validators.min(0)],
    usdToSypRate: [null as number | null, validUsdRate],
    pricedBuildings: this.fb.array<PricedBuildingGroup>([])
  });

  private pricedBuildings = toSignal(this.form.controls.pricedBuildings.valueChanges, { initialValue: [] });
  private usdRate = toSignal(this.form.controls.usdToSypRate.valueChanges, { initialValue: null });
  costTotal = computed(() => this.pricedBuildings().reduce((sum, b) => sum + (b.area ?? 0) * (b.unitPrice ?? 0), 0));

  ngOnInit() {
    const r = this.response();
    if (r) {
      this.costsInUsd.set(r.costsInUsd || (r.initialCost == null && !r.costItems.length));
      this.form.patchValue({
        responseDate: dateOnly(r.responseDate), proposedManagerUserId: r.proposedManagerUserId ?? 0,
        recommendation: r.recommendation, siteArea: r.siteArea, initialCost: r.initialCost,
        usdToSypRate: r.usdToSypRate ?? null
      });
      this.loadBuildings(r);
    }

    this.lookups.employees({ branchId: this.parent().branchId })
      .pipe(orEmpty(() => this.missing.update(m => [...m, 'موظفو الفرع (لاختيار مدير المشروع المقترح)'])))
      .subscribe(list => this.employees.set(list));
  }

  /** المباني بترتيب الحفظ (النوع ثم الترتيب)، وسعر كل مبنى من بند التكلفة المقابل له */
  private loadBuildings(r: StudyResponse) {
    const details = BUILDING_TYPES.flatMap(type =>
      (r.buildings.find(b => b.buildingType === type.value)?.details ?? []).map(d => ({ ...d, buildingType: type.value })));
    const priced = r.costItems.length === details.length && details.every((d, i) => r.costItems[i].quantity === d.area);
    details.forEach((d, i) => this.addBuilding({
      buildingType: d.buildingType, code: d.code, function: d.function, area: d.area,
      unitPrice: priced ? r.costItems[i].unitPrice : null
    }));
    const undetailed = r.buildings.some(b => b.buildingCount > (b.details?.length ?? 0));
    this.incomplete.set(undetailed || (!priced && r.costItems.length > 0));
  }

  private buildingDetail(detail?: ResponseBuildingDetail) {
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
    const type = BUILDING_TYPES.find(option => option.value === building.buildingType)?.label ?? '';
    return `${type} — ${building.code.trim()} — ${building.function.trim()}`;
  }

  buildingLimitsExceeded() {
    return BUILDING_TYPES.some(type => this.buildingSummary(type.value).area > MAX_BUILDING_AREA);
  }

  remove(array: FormArray, index: number) { array.removeAt(index); array.markAsDirty(); }
  costMoney(value: number) { return responseMoney(value, this.costsInUsd()); }

  equivalent(value: number | null) {
    return this.costsInUsd() && this.form.controls.usdToSypRate.valid ? syrianEquivalent(value, this.usdRate()) : '';
  }

  /** رد مسعّر بالليرة: الانتقال إلى الدولار يفرغ المبالغ القديمة ليُعاد إدخالها (لا تحويل بسعر مفترض) */
  enableUsdPricing() {
    const { initialCost, pricedBuildings } = this.form.controls;
    if (initialCost.value != null) initialCost.addValidators(Validators.required);
    initialCost.setValue(null);
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
      buildings: BUILDING_TYPES.flatMap(type => {
        const details = pricedBuildings.filter(row => row.buildingType === type.value)
          .map(row => ({ code: row.code.trim(), function: row.function.trim(), area: row.area! }));
        const { count, area } = this.buildingSummary(type.value);
        return count ? [{ buildingType: type.value, buildingCount: count, buildingsArea: area, details }] : [];
      }),
      costItems: pricedBuildings.map(row => ({ description: this.buildingDescription(row), unit: 'م²', quantity: row.area!, unitPrice: row.unitPrice! })),
      rowVersion: r?.rowVersion ?? null
    };
    const call = r ? this.service.update('responses', r.id, body) : this.service.create('responses', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
