import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { AppPermission, SITE_PICK_ACCESS } from '@core/constants/access';
import { GOVERNORATES } from '@core/constants/governorates';
import { orEmpty } from '@core/http/or-empty';
import { Branch } from '@core/models/ewms.models';
import { AuthService } from '@core/services/auth.service';
import { LookupsService } from '@core/services/lookups.service';
import { localDateInput } from '@core/utils/format';
import { isValidPhone, normalizePhone } from '@core/utils/phone';
import { Alert } from '@shared/ui/alert';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { trackRequest } from '@shared/ui/track-request';
import { StudyDocumentsService } from '../data-access/study-documents.service';
import { StudyLookupsService } from '../data-access/study-lookups.service';
import { SiteLookupService, SiteOption } from '@core/services/site-lookup.service';
import { StudyLookup, StudyRequest, StudyRequestInput, URGENCIES, WORK_TYPES } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';
import { SearchSelect, SelectOption } from '@shared/ui/search-select';

const phone = (c: AbstractControl<string>) => !c.value.trim() || isValidPhone(c.value) ? null : { phone: true };

/**
 * طلب تجهيز الدراسة — رقمه يُدخل يدوياً من الديوان المركزي.
 * يأخذ فرع المستخدم؛ من يتصفح المؤسسة يختار الفرع عند الإنشاء. الموقع من سجل المواقع اختياري (لمن يملك صلاحية عرض المواقع):
 * يُنسخ إلى المشروع فيظهر على خريطة الفرع.
 */
@Component({
  selector: 'app-study-request-form-dialog',
  standalone: true,
  imports: [SearchSelect, SelectOption, ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  styles: [`
    .request-options { gap: 16px; }
    @media (max-width: 760px) { .request-branch { grid-column: 1 / -1; } }
    @media (max-width: 640px) { .request-options { grid-template-columns: minmax(0, 1fr); } }
  `],
  templateUrl: './request-form-dialog.html'
})
export class StudyRequestFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private auth = inject(AuthService);
  private lookups = inject(LookupsService);
  private siteLookup = inject(SiteLookupService);
  private studyLookups = inject(StudyLookupsService);
  private beneficiaryReload = new Subject<void>();

  /** null = طلب جديد */
  request = input<StudyRequest | null>(null);
  saved = output<StudyRequest>();
  closed = output<void>();

  governorates = GOVERNORATES;
  urgencies = URGENCIES;
  workTypes = WORK_TYPES;
  saving = signal(false);
  error = signal('');
  /** اختيار الفرع لمن يتصفح المؤسسة، عند الإنشاء فقط (الطلب لا ينتقل بين الفروع) */
  chooseBranch = computed(() => !this.request() && this.auth.hasPermission(AppPermission.ViewOrganizationDashboard));
  branches = signal<Branch[]>([]);
  /** قائمة مساعدة لم تُحمَّل (نقص صلاحية): يُقال في النموذج */
  missing = signal('');
  beneficiaries = signal<StudyLookup[]>([]);
  activeBeneficiaries = computed(() => this.beneficiaries().filter(b => b.isActive && b.code?.trim()));
  beneficiariesLoading = signal(true);
  beneficiaryError = signal('');
  /** الجهة المحفوظة تبقى قابلة للاختيار بعد تعطيلها، ويُحفظ اسمها كما ورد في الطلب. */
  beneficiaryOptions = computed(() => {
    const current = this.request(), options = this.activeBeneficiaries();
    if (!current?.mainBeneficiaryId) return options;
    const configured = this.beneficiaries().find(b => b.id === current.mainBeneficiaryId);
    const saved: StudyLookup = {
      id: current.mainBeneficiaryId, name: current.mainBeneficiary,
      code: configured ? configured.code : current.entityCode, isActive: configured?.isActive ?? false
    };
    return options.some(b => b.id === saved.id)
      ? options.map(b => b.id === saved.id ? saved : b)
      : [saved, ...options];
  });

  /** حقل الموقع يظهر لمن يقرأ سجل المواقع (AnySiteView: ومنهم كاتب الطلب)؛ بدونها يبقى موقع الطلب كما هو */
  canPickSite = this.auth.hasAnyPermission(SITE_PICK_ACCESS);
  private allSites = signal<SiteOption[]>([]);
  private governorate = signal('');
  /** مواقع المحافظة المختارة، ويبقى الموقع المحفوظ في الطلب ظاهراً ولو خرج من القائمة */
  siteOptions = computed(() => {
    const code = this.governorate(), current = this.request()?.siteId;
    return this.allSites().filter(s => s.governorateCode === code || s.id === current);
  });

  form = inject(FormBuilder).nonNullable.group({
    branchId: [0],
    requestNumber: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)]],
    requestDate: [localDateInput(), Validators.required],
    urgency: [2, Validators.required],
    workType: [1, Validators.required],
    mainBeneficiaryId: [0, [Validators.required, Validators.min(1)]],
    subBeneficiary: ['', Validators.maxLength(200)],
    entityCode: ['', [Validators.required, Validators.maxLength(30)]],
    governorateCode: ['', Validators.required],
    /** 0 = بلا موقع */
    siteId: [0],
    area: ['', Validators.maxLength(100)],
    cityOrVillage: ['', Validators.maxLength(100)],
    propertyNature: ['', Validators.maxLength(100)],
    ministryArchiveNumber: ['', Validators.maxLength(50)],
    ministryArchiveDate: [''],
    adminArchiveNumber: ['', Validators.maxLength(50)],
    adminArchiveDate: [''],
    beneficiaryArchiveNumber: ['', Validators.maxLength(50)],
    addedDate: [''],
    followerName: ['', Validators.maxLength(150)],
    followerPhone: ['', phone],
    notes: ['', Validators.maxLength(2000)]
  });

  constructor() {
    this.form.controls.mainBeneficiaryId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncEntityCode());
    this.beneficiaryReload.pipe(
      switchMap(() => {
        this.beneficiariesLoading.set(true);
        this.beneficiaryError.set('');
        return this.studyLookups.lookup('beneficiaries', !this.request()).pipe(catchError(() => {
          this.beneficiaryError.set('تعذّر تحميل الجهات المستفيدة. أعد المحاولة.');
          return of([] as StudyLookup[]);
        }));
      }),
      takeUntilDestroyed()
    ).subscribe(list => {
      this.beneficiaries.set(list);
      this.syncEntityCode();
      this.beneficiariesLoading.set(false);
    });
  }

  loadBeneficiaries() { this.beneficiaryReload.next(); }

  private syncEntityCode() {
    const beneficiary = this.beneficiaryOptions().find(b => b.id === this.form.controls.mainBeneficiaryId.value);
    this.form.controls.entityCode.setValue(beneficiary?.code?.trim() ?? '');
  }

  ngOnInit() {
    const r = this.request();
    if (r) {
      this.form.reset({
        branchId: r.branchId, requestNumber: r.requestNumber, requestDate: dateOnly(r.requestDate), urgency: r.urgency, workType: r.workType,
        mainBeneficiaryId: r.mainBeneficiaryId ?? 0, subBeneficiary: r.subBeneficiary ?? '', entityCode: r.entityCode ?? '',
        governorateCode: r.governorateCode, siteId: r.siteId ?? 0, area: r.area ?? '', cityOrVillage: r.cityOrVillage ?? '', propertyNature: r.propertyNature ?? '',
        ministryArchiveNumber: r.ministryArchiveNumber ?? '', ministryArchiveDate: dateOnly(r.ministryArchiveDate),
        adminArchiveNumber: r.adminArchiveNumber ?? '', adminArchiveDate: dateOnly(r.adminArchiveDate),
        beneficiaryArchiveNumber: r.beneficiaryArchiveNumber ?? '', addedDate: dateOnly(r.addedDate),
        followerName: r.followerName ?? '', followerPhone: r.followerPhone ?? '', notes: r.notes ?? ''
      });
    }
    this.loadBeneficiaries();
    this.governorate.set(this.form.controls.governorateCode.value);
    this.form.controls.governorateCode.valueChanges.subscribe(code => {
      this.governorate.set(code);
      // موقع من محافظة أخرى لا يصلح للمحافظة الجديدة
      const site = this.allSites().find(s => s.id === this.form.controls.siteId.value);
      if (site && site.governorateCode !== code) this.form.controls.siteId.setValue(0);
    });
    if (this.canPickSite) {
      this.siteLookup.all().pipe(orEmpty(() => this.missing.set('تعذّر تحميل المواقع — يبقى موقع الطلب كما هو.')))
        .subscribe(list => this.allSites.set(list));
    }
    if (this.chooseBranch()) {
      this.form.controls.branchId.addValidators(Validators.min(1));
      this.lookups.branchOptions().pipe(orEmpty(() => this.missing.set('تعذّر تحميل قائمة الفروع — تحتاج صلاحية عرض الأقسام أو الفروع.')))
        .subscribe(b => this.branches.set(b));
    }
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving() || this.beneficiariesLoading() || this.beneficiaryError()) return;
    const v = this.form.getRawValue();
    const r = this.request();
    const beneficiary = this.beneficiaryOptions().find(b => b.id === v.mainBeneficiaryId);
    if (!beneficiary?.code?.trim()) return;
    const body: StudyRequestInput = {
      requestNumber: v.requestNumber.trim(), requestDate: v.requestDate, urgency: v.urgency, workType: v.workType,
      mainBeneficiaryId: beneficiary.id, mainBeneficiary: beneficiary.name,
      subBeneficiary: optional(v.subBeneficiary), entityCode: beneficiary.code.trim(),
      governorateCode: v.governorateCode, area: optional(v.area), cityOrVillage: optional(v.cityOrVillage), propertyNature: optional(v.propertyNature),
      diwanRequestNumber: r?.diwanRequestNumber ?? null, ministryArchiveNumber: optional(v.ministryArchiveNumber), ministryArchiveDate: v.ministryArchiveDate || null,
      adminArchiveNumber: optional(v.adminArchiveNumber), adminArchiveDate: v.adminArchiveDate || null,
      beneficiaryArchiveNumber: optional(v.beneficiaryArchiveNumber), addedDate: v.addedDate || null,
      followerName: optional(v.followerName), followerPhone: v.followerPhone.trim() ? normalizePhone(v.followerPhone) : null,
      notes: optional(v.notes),
      // بلا صلاحية المواقع لا يظهر الحقل: يبقى موقع الطلب القائم كما هو
      siteId: this.canPickSite ? (v.siteId || null) : (r?.siteId ?? null),
      branchId: this.chooseBranch() ? v.branchId : null,
      rowVersion: r?.rowVersion ?? null
    };
    const call = r ? this.service.update('requests', r.id, body) : this.service.create('requests', body);
    trackRequest(call, this.saving, this.error, saved => this.saved.emit(saved));
  }
}
