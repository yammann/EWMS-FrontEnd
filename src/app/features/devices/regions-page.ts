import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService, formatCoords } from '../../core/services/device.service';
import { CoordinatePicker, Coordinates } from '../map/coordinate-picker';
import { Region } from '../../core/models/device.models';
import { DevicesNav } from './devices-nav';

/** المناطق التابعة للمؤسسة — كل منطقة تضم مواقع */
@Component({
  selector: 'app-regions-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, DevicesNav, CoordinatePicker],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>المناطق</h1><p class="muted">المناطق التي تُركَّب فيها أجهزة المؤسسة، وكل منطقة تضم عدة مواقع</p></div>
        <div class="header-actions">
          @if (access().canManage) { <button class="btn" type="button" (click)="openForm(null)">+ منطقة جديدة</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>
      <app-devices-nav />

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <section class="panel">
        <div class="panel-heading"><h2>المناطق <span class="count">({{ filtered().length }})</span></h2>
          <input class="search" type="search" placeholder="بحث باسم المنطقة…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        </div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ search() ? 'لا توجد نتائج' : 'لا توجد مناطق بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>المنطقة</th><th>الوصف</th><th>الإحداثيات</th><th>المواقع</th>@if (access().canManage) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr>
                  <td class="cell-strong">{{ r.name }}</td>
                  <td class="wrap">{{ r.description || '—' }}</td>
                  <td>@if (coords(r.latitude, r.longitude); as c) { <span class="mono">{{ c }}</span> } @else { <span class="missing">⚠ بلا إحداثيات</span> }</td>
                  <td><a class="cell-link" [routerLink]="['/devices/sites']" [queryParams]="{ regionId: r.id }">{{ siteCounts().get(r.id) ?? 0 }} موقع ←</a></td>
                  @if (access().canManage) {
                    <td><div class="row-actions">
                      <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(r)">تعديل</button>
                      <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(r)">حذف</button>
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
        <div class="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="region-form-title" (click)="$event.stopPropagation()">
          <header class="modal-header"><h2 id="region-form-title">{{ editing() ? 'تعديل المنطقة' : 'منطقة جديدة' }}</h2>
            <button type="button" class="modal-close" aria-label="إغلاق" (click)="closeForm()">×</button></header>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-stack">
              @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
              <label class="form-field"><span class="form-label">اسم المنطقة</span><input formControlName="name" maxlength="100" placeholder="مثال: المنطقة الشمالية"></label>
              <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="500"></textarea></label>
              <div class="form-field"><span class="form-label">مكان المنطقة على الخريطة</span>
                <app-coordinate-picker [latitude]="form.value.latitude ?? null" [longitude]="form.value.longitude ?? null" (picked)="setCoords($event)" />
              </div>
            </div>
            <footer class="modal-actions">
              <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
              <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
            </footer>
          </form>
        </div>
      </div>
    }

    @if (deleting(); as r) {
      <div class="modal-backdrop" (click)="deleting.set(null)">
        <div class="modal" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-body form-stack">
            <p>حذف المنطقة «{{ r.name }}»؟ لا يمكن حذف منطقة تحتوي على مواقع.</p>
            @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="deleting.set(null)" [disabled]="saving()">تراجع</button>
            <button type="button" class="danger" (click)="remove(r)" [disabled]="saving()">تأكيد الحذف</button>
          </footer>
        </div>
      </div>
    }`
})
export class RegionsPage {
  private service = inject(DeviceService);
  access = this.service.access;

  regions = signal<Region[]>([]);
  siteCounts = signal(new Map<number, number>());
  search = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Region | null>(null); deleting = signal<Region | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.regions().filter(r => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) : this.regions();
  });

  coords = formatCoords;

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    // الإحداثيات إجبارية (خريطة سوريا) — تُحدَّد بالنقر على الخريطة أو يدوياً
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required]
  });

  setCoords(c: Coordinates) { this.form.patchValue(c); }

  constructor() { this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ regions: this.service.regions(), sites: this.service.sites() }).subscribe({
      next: r => { this.regions.set(r.regions); this.siteCounts.set(this.service.countBy(r.sites, s => s.regionId)); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(r: Region | null) {
    this.editing.set(r); this.formError.set('');
    this.form.reset({ name: r?.name ?? '', description: r?.description ?? '', latitude: r?.latitude ?? null, longitude: r?.longitude ?? null });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  askDelete(r: Region) { this.formError.set(''); this.deleting.set(r); }

  @HostListener('document:keydown.escape')
  onEscape() { this.closeForm(); if (!this.saving()) this.deleting.set(null); }

  save() {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const v = { name: f.name!.trim(), description: (f.description ?? '').trim(), latitude: f.latitude!, longitude: f.longitude! };
    const r = this.editing();
    this.saving.set(true); this.formError.set('');
    (r ? this.service.updateRegion(r.id, v) : this.service.createRegion(v)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

  remove(r: Region) {
    this.saving.set(true); this.formError.set('');
    this.service.deleteRegion(r.id).subscribe({
      next: () => { this.saving.set(false); this.deleting.set(null); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }
}
