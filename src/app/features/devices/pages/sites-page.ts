import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DeviceService, formatCoords } from '../data-access/device.service';
import { CoordinatePicker, Coordinates } from '@features/map';
import { Site } from '../data-access/device.models';
import { GOVERNORATES } from '@core/constants/governorates';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';
import { DeviceHistory } from '../components/device-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

/** المواقع — لكل موقع إحداثيات تظهر على خريطة سوريا، والمحافظة (المنطقة) تُحدَّد تلقائياً من النقطة المختارة */
@Component({
  selector: 'app-sites-page', standalone: true, imports: [FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, RouterLink, CoordinatePicker, Modal, DeviceHistory, Pager],
  styleUrls: ['../../../shared/styles/organization.scss', '../../../shared/styles/devices.scss'],
  templateUrl: './sites-page.html',
  styles: [`td small { display: block; color: var(--ink-500); }`]
})
export class SitesPage {
  pager = new Pagination(() => this.filtered());
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  access = this.service.access;
  coords = formatCoords;
  phone = formatPhone;

  sites = signal<Site[]>([]);
  governorates = GOVERNORATES;
  history = signal<Site | null>(null);
  search = signal('');
  governorate = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Site | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const governorate = this.governorate();
    return this.sites().filter(s => (!governorate || s.governorateCode === governorate)
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

  setCoords(c: Coordinates) { this.form.patchValue(c); }

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed())
      .subscribe(p => this.governorate.set(p.get('governorate') ?? ''));
    this.load();
  }

  setGovernorate(code: string) {
    this.router.navigate([], { queryParams: { governorate: code || null }, queryParamsHandling: 'merge' });
  }

  load() {
    trackRequest(this.service.sites(), this.loading, this.error, sites => { this.sites.set(sites); });
  }

  openForm(s: Site | null) {
    this.editing.set(s); this.formError.set('');
    this.form.reset({
      name: s?.name ?? '', description: s?.description ?? '', latitude: s?.latitude ?? null, longitude: s?.longitude ?? null,
      contactName: s?.contactName ?? '', contactPhone: s?.contactPhone ?? '', responsibleParty: s?.responsibleParty ?? ''
    });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  async askDelete(s: Site) {
    if (!await this.confirm.ask(`حذف الموقع «${s.name}»؟ لا يمكن حذف موقع فيه تركيبات.`, 'حذف')) return;
    this.service.deleteSite(s.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const s = this.editing();
    const body = {
      name: (v.name ?? '').trim(), description: (v.description ?? '').trim(), latitude: v.latitude!, longitude: v.longitude!,
      contactName: (v.contactName ?? '').trim(), contactPhone: normalizePhone(v.contactPhone ?? ''), responsibleParty: (v.responsibleParty ?? '').trim(),
      rowVersion: s?.rowVersion ?? null
    };
    trackRequest((s ? this.service.updateSite(s.id, body) : this.service.createSite(body)), this.saving, this.formError, () => { this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); });
  }

}
