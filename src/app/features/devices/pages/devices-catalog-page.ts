import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DeviceService } from '../data-access/device.service';
import { DEVICE_CATEGORIES, Device } from '../data-access/device.models';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { DeviceHistory } from '../components/device-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';

/** أنواع الأجهزة (قابلة للتكرار) — كل تركيب في موقع له IP ومعلومات خاصة به من صفحة التركيبات */
@Component({
  selector: 'app-devices-catalog-page', standalone: true, imports: [FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, RouterLink, Modal, DeviceHistory, Pager],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  templateUrl: './devices-catalog-page.html',
  styles: [`td small { display: block; color: var(--ink-500); }`]
})
export class DevicesCatalogPage {
  pager = new Pagination(() => this.filtered());
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  access = this.service.access;

  devices = signal<Device[]>([]);
  history = signal<Device | null>(null);
  /** اقتراحات الفئة: المقترحة + المستخدمة في الكتالوج */
  categories = computed(() => [...new Set([...DEVICE_CATEGORIES, ...this.devices().map(d => d.category).filter(Boolean)])]);
  manufacturers = computed(() => [...new Set(this.devices().map(d => d.manufacturer).filter(Boolean))].sort());
  search = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Device | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.devices().filter(d => [d.name, d.model, d.description, d.category, d.manufacturer].some(f => (f ?? '').toLowerCase().includes(q))) : this.devices();
  });

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(500)],
    category: ['', Validators.maxLength(50)],
    manufacturer: ['', Validators.maxLength(100)]
  });

  constructor() { this.load(); }

  load() {
    trackRequest(this.service.devices(), this.loading, this.error, devices => { this.devices.set(devices); });
  }

  openForm(d: Device | null) {
    this.editing.set(d); this.formError.set('');
    this.form.reset({ name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '', category: d?.category ?? '', manufacturer: d?.manufacturer ?? '' });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  async askDelete(d: Device) {
    if (!await this.confirm.ask(`حذف الجهاز «${d.name}»؟ لا يمكن حذف جهاز له تركيبات.`, 'حذف')) return;
    this.service.deleteDevice(d.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const d = this.editing();
    const body = {
      name: v.name.trim(), model: v.model.trim(), description: v.description.trim(), category: v.category.trim(), manufacturer: v.manufacturer.trim(),
      rowVersion: d?.rowVersion ?? null
    };
    trackRequest((d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)), this.saving, this.formError, () => { this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); });
  }

}
