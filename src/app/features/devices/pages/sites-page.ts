import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DeviceService, SiteInput, formatCoords } from '../data-access/device.service';
import { CoordinatePicker, Coordinates } from '@features/map';
import { NearbySite, Site } from '../data-access/device.models';
import { GOVERNORATES } from '@core/constants/governorates';
import { Modal } from '@shared/ui/modal';
import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';
import { DeviceHistory } from '../components/device-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { CrudPage } from '@shared/ui/crud-page';
import { RowActions } from '@shared/ui/row-actions';
import { FormActions } from '@shared/ui/form-actions';
import { SelectValue } from '@shared/ui/select-value';
import { Icon } from '@shared/ui/icon';

/**
 * سجل المواقع المشترك بين الفروع (النمط الموحّد CrudPage) — لكل موقع إحداثيات تظهر على خريطة سوريا، والمحافظة تُحدَّد
 * تلقائياً من النقطة. الصلاحيات ViewSites/CreateSite/EditSite/DeleteSite؛ وعمود التركيبات لمن يرى الأجهزة (ضمن حدّه).
 */
@Component({
  selector: 'app-sites-page', standalone: true, imports: [Icon, SelectValue, FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, RouterLink, CoordinatePicker, Modal, DeviceHistory, Pager, RowActions],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  templateUrl: './sites-page.html',
  styles: [`td small { display: block; color: var(--ink-500); }
    .nearby { margin: 8px 0 0; padding: 8px 12px; border-radius: 10px; background: var(--warning-50); color: var(--warning-700); font-size: 13px; }`]
})
export class SitesPage {
  private service = inject(DeviceService);
  private router = inject(Router);
  access = this.service.siteAccess;
  deviceAccess = this.service.access;
  /** مواقع على بُعد 200 متر من النقطة المختارة — تنبيه كي لا يتكرر موقع في السجل المشترك */
  nearby = signal<NearbySite[]>([]);
  private point$ = new Subject<{ latitude: number; longitude: number } | null>();
  coords = formatCoords;
  phone = formatPhone;

  governorates = GOVERNORATES;
  history = signal<Site | null>(null);
  search = signal('');
  governorate = signal('');

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const governorate = this.governorate();
    return this.crud.items().filter(s => (!governorate || s.governorateCode === governorate)
      && (!q || [s.name, s.description, s.contactName, s.responsibleParty].some(f => (f ?? '').toLowerCase().includes(q))));
  });

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    // الإحداثيات إجبارية (خريطة سوريا) — تُحدَّد بالنقر على الخريطة أو يدوياً
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required],
    contactName: ['', Validators.maxLength(100)],
    contactPhone: ['', (c: { value: string | null }) => isValidPhone(c.value ?? '') ? null : { phone: true }],
    responsibleParty: ['', Validators.maxLength(150)]
  });

  setCoords(c: Coordinates) {
    this.form.patchValue(c);
    this.point$.next(c);
  }

  crud = new CrudPage<Site, SiteInput>({
    load: () => this.service.sites(),
    create: body => this.service.createSite(body),
    // rowVersion كما وصل: يمنع محو تعديل مستخدم آخر بصمت
    update: (id, body, s) => this.service.updateSite(id, { ...body, rowVersion: s.rowVersion }),
    remove: s => this.service.deleteSite(s.id),
    can: { create: () => this.access().canCreate, edit: () => this.access().canEdit, delete: () => this.access().canDelete },
    onOpen: s => {
      this.form.reset({
        name: s?.name ?? '', description: s?.description ?? '', latitude: s?.latitude ?? null, longitude: s?.longitude ?? null,
        contactName: s?.contactName ?? '', contactPhone: s?.contactPhone ?? '', responsibleParty: s?.responsibleParty ?? ''
      });
      this.nearby.set([]);
      this.point$.next(null);
    },
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'المواقع',
      confirmDelete: s => `حذف الموقع «${s.name}» من السجل المشترك؟ لا يمكن حذف موقع عليه تركيبات أو بيانات لأي فرع.`
    }
  });
  pager = new Pagination(() => this.filtered());

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed())
      .subscribe(p => this.governorate.set(p.get('governorate') ?? ''));

    // كل نقطة جديدة تلغي فحص السابقة؛ فشل الفحص لا يمنع الحفظ (تنبيه فقط)
    this.point$.pipe(
      debounceTime(300),
      switchMap(p => p ? this.service.nearbySites(p.latitude, p.longitude, this.crud.dialog()?.item?.id ?? null).pipe(catchError(() => of([]))) : of([])),
      takeUntilDestroyed()
    ).subscribe(list => this.nearby.set(list));
  }

  setGovernorate(code: string) {
    this.router.navigate([], { queryParams: { governorate: code || null }, queryParamsHandling: 'merge' });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.crud.save({
      name: (v.name ?? '').trim(), description: (v.description ?? '').trim(), latitude: v.latitude!, longitude: v.longitude!,
      contactName: (v.contactName ?? '').trim(), contactPhone: normalizePhone(v.contactPhone ?? ''), responsibleParty: (v.responsibleParty ?? '').trim()
    });
  }

}
