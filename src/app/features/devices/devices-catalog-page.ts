import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { Device } from '../../core/models/device.models';
import { DevicesNav } from './devices-nav';

/** أنواع الأجهزة (قابلة للتكرار) — كل تركيب في موقع له IP ومعلومات خاصة به من صفحة التركيبات */
@Component({
  selector: 'app-devices-catalog-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, DevicesNav],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>الأجهزة</h1><p class="muted">أنواع وموديلات الأجهزة — الجهاز الواحد يمكن تركيبه عدة مرات في نفس الموقع أو في مواقع مختلفة</p></div>
        <div class="header-actions">
          @if (access().canManage) { <button class="btn" type="button" (click)="openForm(null)">+ جهاز جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>
      <app-devices-nav />

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <section class="panel">
        <div class="panel-heading"><h2>الأجهزة <span class="count">({{ filtered().length }})</span></h2>
          <input class="search" type="search" placeholder="بحث بالاسم أو الموديل…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        </div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ search() ? 'لا توجد نتائج' : 'لا توجد أجهزة بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الجهاز</th><th>الموديل</th><th>الوصف</th><th>التركيبات</th>@if (access().canManage) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (d of filtered(); track d.id) {
                <tr>
                  <td class="cell-strong">{{ d.name }}</td>
                  <td>{{ d.model || '—' }}</td>
                  <td class="wrap">{{ d.description || '—' }}</td>
                  <td><a class="cell-link" [routerLink]="['/devices/installations']" [queryParams]="{ deviceId: d.id }">{{ installCounts().get(d.id) ?? 0 }} تركيب ←</a></td>
                  @if (access().canManage) {
                    <td><div class="row-actions">
                      <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(d)">تعديل</button>
                      <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(d)">حذف</button>
                    </div></td>
                  }
                </tr>
              }
            </tbody>
          </table></div>
        }
      </section>
    </div>

    @if (formOpen()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="device-form-title" (click)="$event.stopPropagation()">
          <header class="modal-header"><h2 id="device-form-title">{{ editing() ? 'تعديل الجهاز' : 'جهاز جديد' }}</h2>
            <button type="button" class="modal-close" aria-label="إغلاق" (click)="closeForm()">×</button></header>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-grid-2">
              @if (formError()) { <p class="alert alert-error full" role="alert">{{ formError() }}</p> }
              <label class="form-field full"><span class="form-label">اسم الجهاز</span><input formControlName="name" maxlength="100" placeholder="مثال: راوتر رئيسي"></label>
              <label class="form-field full"><span class="form-label">الموديل <small class="hint">(اختياري)</small></span><input formControlName="model" maxlength="100" dir="ltr"></label>
              <p class="hint full">الرقم التسلسلي يُسجَّل لكل قطعة عند تركيبها (صفحة التركيبات).</p>
              <label class="form-field full"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="500"></textarea></label>
            </div>
            <footer class="modal-actions">
              <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
              <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
            </footer>
          </form>
        </div>
      </div>
    }

    @if (deleting(); as d) {
      <div class="modal-backdrop" (click)="deleting.set(null)">
        <div class="modal" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-body form-stack">
            <p>حذف الجهاز «{{ d.name }}»؟ لا يمكن حذف جهاز له تركيبات.</p>
            @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button>
            <button type="button" class="danger" (click)="remove(d)" [disabled]="saving()">تأكيد الحذف</button>
          </footer>
        </div>
      </div>
    }`
})
export class DevicesCatalogPage {
  private service = inject(DeviceService);
  access = this.service.access;

  devices = signal<Device[]>([]);
  installCounts = signal(new Map<number, number>());
  search = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Device | null>(null); deleting = signal<Device | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.devices().filter(d => [d.name, d.model, d.description].some(f => (f ?? '').toLowerCase().includes(q))) : this.devices();
  });

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(500)]
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ devices: this.service.devices(), installations: this.service.installations() }).subscribe({
      next: r => { this.devices.set(r.devices); this.installCounts.set(this.service.countBy(r.installations, i => i.deviceId)); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(d: Device | null) {
    this.editing.set(d); this.formError.set('');
    this.form.reset({ name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '' });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  askDelete(d: Device) { this.formError.set(''); this.deleting.set(d); }

  @HostListener('document:keydown.escape')
  onEscape() { this.closeForm(); if (!this.saving()) this.deleting.set(null); }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), model: v.model.trim(), description: v.description.trim() };
    const d = this.editing();
    this.saving.set(true); this.formError.set('');
    (d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

  remove(d: Device) {
    this.saving.set(true); this.formError.set('');
    this.service.deleteDevice(d.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }
}
