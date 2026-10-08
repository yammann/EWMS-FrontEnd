import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DeviceService } from '@core/services/device.service';
import { DEVICE_CATEGORIES, Device } from '@core/models/device.models';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { DeviceHistory } from './device-ui';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';

/** أنواع الأجهزة (قابلة للتكرار) — كل تركيب في موقع له IP ومعلومات خاصة به من صفحة التركيبات */
@Component({
  selector: 'app-devices-catalog-page', standalone: true, imports: [EmptyState, Alert, ReactiveFormsModule, RouterLink, Modal, DeviceHistory, Pager],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>الأجهزة</h1><p class="muted">أنواع وموديلات الأجهزة — الجهاز الواحد يمكن تركيبه عدة مرات في نفس الموقع أو في مواقع مختلفة</p></div>
        <div class="header-actions">
          @if (access().canCreate) { <button class="btn" type="button" (click)="openForm(null)">+ جهاز جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      <app-alert [message]="error()" />

      <section class="panel">
        <div class="panel-heading"><h2>الأجهزة <span class="count">({{ filtered().length }})</span></h2>
          <input class="search" type="search" placeholder="بحث بالاسم أو الموديل أو الفئة أو الشركة…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        </div>
        @if (loading()) { <app-empty-state>جارٍ التحميل…</app-empty-state> }
        @else if (!filtered().length) { <app-empty-state>{{ search() ? 'لا توجد نتائج' : 'لا توجد أجهزة بعد' }}</app-empty-state> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الجهاز</th><th>الموديل</th><th>الفئة</th><th>الشركة المصنّعة</th><th>التركيبات</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (d of pager.items(); track d.id) {
                <tr>
                  <td><span class="cell-strong">{{ d.name }}</span>@if (d.description) { <small>{{ d.description }}</small> }</td>
                  <td>@if (d.model) { <span class="mono">{{ d.model }}</span> } @else { <span class="muted-cell">—</span> }</td>
                  <td>{{ d.category || '—' }}</td>
                  <td>{{ d.manufacturer || '—' }}</td>
                  <td><a class="cell-link" [routerLink]="['/devices/installations']" [queryParams]="{ deviceId: d.id }">{{ d.installationsCount }} تركيب ←</a></td>
                  <td><div class="row-actions">
                    <button class="btn btn-ghost btn-sm" type="button" (click)="history.set(d)">السجل</button>
                    @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(d)">تعديل</button> }
                    @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(d)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
      <app-pager [sizes]="pager.sizes" [page]="pager.page()" [pageSize]="pager.size()" [total]="pager.total()" (pageChange)="pager.go($event)" (sizeChange)="pager.setSize($event)" />
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-modal [heading]="editing() ? 'تعديل الجهاز' : 'جهاز جديد'" [busy]="saving()" (closed)="closeForm()">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-grid-2">
              @if (formError()) { <p class="alert alert-error full" role="alert">{{ formError() }}</p> }
              <label class="form-field full"><span class="form-label">اسم الجهاز</span><input formControlName="name" maxlength="100" placeholder="مثال: راوتر رئيسي"></label>
              <label class="form-field full"><span class="form-label">الموديل <small class="hint">(اختياري — الاسم والموديل لا يتكرران معاً)</small></span><input formControlName="model" maxlength="100" dir="ltr"></label>
              <label class="form-field"><span class="form-label">الفئة <small class="hint">(اختياري)</small></span><input formControlName="category" maxlength="50" list="device-categories" placeholder="كاميرا، سويتش…">
                <datalist id="device-categories">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist></label>
              <label class="form-field"><span class="form-label">الشركة المصنّعة <small class="hint">(اختياري)</small></span><input formControlName="manufacturer" maxlength="100" list="device-makers">
                <datalist id="device-makers">@for (m of manufacturers(); track m) { <option [value]="m"></option> }</datalist></label>
              <p class="hint full">الرقم التسلسلي يُسجَّل لكل قطعة عند تركيبها (صفحة التركيبات).</p>
              <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="500"></textarea></label>
            </div>
            <footer class="modal-actions">
              <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
              <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
            </footer>
          </form>
      </app-modal>
    }

    @if (history(); as h) { <app-device-history kind="device" [entityId]="h.id" [title]="h.name + (h.model ? ' (' + h.model + ')' : '')" (closed)="history.set(null)" /> }
`,
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
    this.loading.set(true); this.error.set('');
    this.service.devices().subscribe({
      next: devices => { this.devices.set(devices); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
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
    this.saving.set(true); this.formError.set('');
    (d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
