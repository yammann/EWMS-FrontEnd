import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Pagination } from '@core/utils/pagination';
import { Alert } from '@shared/ui/alert';
import { CrudPage } from '@shared/ui/crud-page';
import { EmptyState } from '@shared/ui/empty-state';
import { FormActions } from '@shared/ui/form-actions';
import { Modal } from '@shared/ui/modal';
import { PageHeader } from '@shared/ui/page-header';
import { Pager } from '@shared/ui/pager';
import { RowActions } from '@shared/ui/row-actions';
import { DeviceHistory } from '../components/device-ui';
import { DeviceInput, DeviceService } from '../data-access/device.service';
import { DEVICE_CATEGORIES, Device } from '../data-access/device.models';

/** أنواع الأجهزة (قابلة للتكرار) — كل تركيب في موقع له IP ومعلومات خاصة به من صفحة التركيبات. النمط الموحّد (CrudPage). */
@Component({
  selector: 'app-devices-catalog-page', standalone: true,
  imports: [FormActions, PageHeader, EmptyState, Alert, ReactiveFormsModule, RouterLink, Modal, DeviceHistory, Pager, RowActions],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  templateUrl: './devices-catalog-page.html',
  styles: [`td small { display: block; color: var(--ink-500); }`]
})
export class DevicesCatalogPage {
  private service = inject(DeviceService);
  access = this.service.access;

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(500)],
    category: ['', Validators.maxLength(50)],
    manufacturer: ['', Validators.maxLength(100)]
  });

  crud = new CrudPage<Device, DeviceInput>({
    load: () => this.service.devices(),
    create: body => this.service.createDevice(body),
    // rowVersion كما وصل: يمنع محو تعديل مستخدم آخر بصمت
    update: (id, body, d) => this.service.updateDevice(id, { ...body, rowVersion: d.rowVersion }),
    remove: d => this.service.deleteDevice(d.id),
    can: { create: () => this.access().canCreate, edit: () => this.access().canEdit, delete: () => this.access().canDelete },
    onOpen: d => this.form.reset({ name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '', category: d?.category ?? '', manufacturer: d?.manufacturer ?? '' }),
    messages: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', plural: 'الأجهزة',
      confirmDelete: d => `حذف الجهاز «${d.name}»؟ لا يمكن حذف جهاز له تركيبات.`
    }
  });

  history = signal<Device | null>(null);
  search = signal('');
  /** اقتراحات الفئة: المقترحة + المستخدمة في الكتالوج */
  categories = computed(() => [...new Set([...DEVICE_CATEGORIES, ...this.crud.items().map(d => d.category).filter(Boolean)])]);
  manufacturers = computed(() => [...new Set(this.crud.items().map(d => d.manufacturer).filter(Boolean))].sort());
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.crud.items();
    return q ? all.filter(d => [d.name, d.model, d.description, d.category, d.manufacturer].some(f => (f ?? '').toLowerCase().includes(q))) : all;
  });
  pager = new Pagination(() => this.filtered());

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.crud.save({ name: v.name.trim(), model: v.model.trim(), description: v.description.trim(), category: v.category.trim(), manufacturer: v.manufacturer.trim() });
  }
}
