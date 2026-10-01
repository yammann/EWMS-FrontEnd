import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService, formatCoords } from '../../core/services/device.service';
import { CoordinatePicker, Coordinates } from '../map/coordinate-picker';
import { Region } from '../../core/models/device.models';
import { DevicesNav } from './devices-nav';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';

/** المناطق التابعة للمؤسسة — كل منطقة تضم مواقع */
@Component({
  selector: 'app-regions-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, DevicesNav, CoordinatePicker, Modal],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>المناطق</h1><p class="muted">المناطق التي تُركَّب فيها أجهزة المؤسسة، وكل منطقة تضم عدة مواقع</p></div>
        <div class="header-actions">
          @if (access().canCreate) { <button class="btn" type="button" (click)="openForm(null)">+ منطقة جديدة</button> }
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
            <thead><tr><th>المنطقة</th><th>الوصف</th><th>الإحداثيات</th><th>المواقع</th>@if (access().canEdit || access().canDelete) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr>
                  <td class="cell-strong">{{ r.name }}</td>
                  <td class="wrap">{{ r.description || '—' }}</td>
                  <td>@if (coords(r.latitude, r.longitude); as c) { <span class="mono">{{ c }}</span> } @else { <span class="missing">⚠ بلا إحداثيات</span> }</td>
                  <td><a class="cell-link" [routerLink]="['/devices/sites']" [queryParams]="{ regionId: r.id }">{{ siteCounts().get(r.id) ?? 0 }} موقع ←</a></td>
                  @if (access().canEdit || access().canDelete) {
                    <td><div class="row-actions">
                      @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(r)">تعديل</button> }
                      @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(r)">حذف</button> }
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
      <app-modal [heading]="editing() ? 'تعديل المنطقة' : 'منطقة جديدة'" size="lg" [busy]="saving()" (closed)="closeForm()">
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
      </app-modal>
    }
`
})
export class RegionsPage {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  access = this.service.access;

  regions = signal<Region[]>([]);
  siteCounts = signal(new Map<number, number>());
  search = signal('');
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Region | null>(null);

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
  async askDelete(r: Region) {
    if (!await this.confirm.ask(`حذف المنطقة «${r.name}»؟ لا يمكن حذف منطقة تحتوي على مواقع.`, 'حذف')) return;
    this.service.deleteRegion(r.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const v = { name: f.name!.trim(), description: (f.description ?? '').trim(), latitude: f.latitude!, longitude: f.longitude! };
    const r = this.editing();
    this.saving.set(true); this.formError.set('');
    (r ? this.service.updateRegion(r.id, v) : this.service.createRegion(v)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
