import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppPermission, SITE_ACCESS } from '@core/constants/access';
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
import { StudyRequest, StudyRequestInput, StudySiteOption, URGENCIES, WORK_TYPES } from '../data-access/studies.models';
import { dateOnly } from '../utils/document-meta';
import { optional } from '../utils/form-rows';

const phone = (c: AbstractControl<string>) => !c.value.trim() || isValidPhone(c.value) ? null : { phone: true };

/**
 * طلب تجهيز الدراسة (REQ) — حقول النموذج الورقي الوارد من مكتب المدير.
 * يأخذ فرع المستخدم؛ من يتصفح المؤسسة يختار الفرع عند الإنشاء. الموقع من سجل المواقع اختياري (لمن يملك صلاحية عرض المواقع):
 * يُنسخ إلى المشروع فيظهر على خريطة الفرع.
 */
@Component({
  selector: 'app-study-request-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, Alert, FormActions],
  styleUrls: ['../../../shared/styles/data-tools.scss', './study-form.scss'],
  templateUrl: './request-form-dialog.html'
})
export class StudyRequestFormDialog implements OnInit {
  private service = inject(StudyDocumentsService);
  private auth = inject(AuthService);
  private lookups = inject(LookupsService);
  private studyLookups = inject(StudyLookupsService);

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

  /** حقل الموقع يظهر لمن يملك صلاحية عرض المواقع فقط؛ بدونها يبقى موقع الطلب كما هو */
  canPickSite = this.auth.hasAnyPermission(SITE_ACCESS);
  private allSites = signal<StudySiteOption[]>([]);
  private governorate = signal('');
  /** مواقع المحافظة المختارة، ويبقى الموقع المحفوظ في الطلب ظاهراً ولو خرج من القائمة */
  siteOptions = computed(() => {
    const code = this.governorate(), current = this.request()?.siteId;
    return this.allSites().filter(s => s.governorateCode === code || s.id === current);
  });

  form = inject(FormBuilder).nonNullable.group({
    branchId: [0],
    requestDate: [localDateInput(), Validators.required],
    urgency: [2, Validators.required],
    workType: [1, Validators.required],
    mainBeneficiary: ['', [Validators.required, Validators.maxLength(200)]],
    subBeneficiary: ['', Validators.maxLength(200)],
    entityCode: ['', Validators.maxLength(30)],
    governorateCode: ['', Validators.required],
    /** 0 = بلا موقع */
    siteId: [0],
    area: ['', Validators.maxLength(100)],
    cityOrVillage: ['', Validators.maxLength(100)],
    propertyNature: ['', Validators.maxLength(100)],
    diwanRequestNumber: ['', Validators.maxLength(50)],
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

  ngOnInit() {
    const r = this.request();
    if (r) {
      this.form.reset({
        branchId: r.branchId, requestDate: dateOnly(r.requestDate), urgency: r.urgency, workType: r.workType,
        mainBeneficiary: r.mainBeneficiary, subBeneficiary: r.subBeneficiary ?? '', entityCode: r.entityCode ?? '',
        governorateCode: r.governorateCode, siteId: r.siteId ?? 0, area: r.area ?? '', cityOrVillage: r.cityOrVillage ?? '', propertyNature: r.propertyNature ?? '',
        diwanRequestNumber: r.diwanRequestNumber ?? '', ministryArchiveNumber: r.ministryArchiveNumber ?? '', ministryArchiveDate: dateOnly(r.ministryArchiveDate),
        adminArchiveNumber: r.adminArchiveNumber ?? '', adminArchiveDate: dateOnly(r.adminArchiveDate),
        beneficiaryArchiveNumber: r.beneficiaryArchiveNumber ?? '', addedDate: dateOnly(r.addedDate),
        followerName: r.followerName ?? '', followerPhone: r.followerPhone ?? '', notes: r.notes ?? ''
      });
    }
    this.governorate.set(this.form.controls.governorateCode.value);
    this.form.controls.governorateCode.valueChanges.subscribe(code => {
      this.governorate.set(code);
      // موقع من محافظة أخرى لا يصلح للمحافظة الجديدة
      const site = this.allSites().find(s => s.id === this.form.controls.siteId.value);
      if (site && site.governorateCode !== code) this.form.controls.siteId.setValue(0);
    });
    if (this.canPickSite) {
      this.studyLookups.sites().pipe(orEmpty(() => this.missing.set('تعذّر تحميل المواقع — يبقى موقع الطلب كما هو.')))
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
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.request();
    const body: StudyRequestInput = {
      requestDate: v.requestDate, urgency: v.urgency, workType: v.workType,
      mainBeneficiary: v.mainBeneficiary.trim(), subBeneficiary: optional(v.subBeneficiary), entityCode: optional(v.entityCode),
      governorateCode: v.governorateCode, area: optional(v.area), cityOrVillage: optional(v.cityOrVillage), propertyNature: optional(v.propertyNature),
      diwanRequestNumber: optional(v.diwanRequestNumber), ministryArchiveNumber: optional(v.ministryArchiveNumber), ministryArchiveDate: v.ministryArchiveDate || null,
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
