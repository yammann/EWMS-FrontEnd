import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService, formatCoords } from '../../core/services/device.service';
import { CoordinatePicker, Coordinates } from '../map/coordinate-picker';
import { Region, Site } from '../../core/models/device.models';
import { DevicesNav } from './devices-nav';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';

/** المواقع داخل المناطق — لكل موقع إحداثيات تظهر على خريطة سوريا في لوحة المتابعة */
@Component({
  selector: 'app-sites-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, DevicesNav, CoordinatePicker, Modal],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>المواقع</h1><p class="muted">مواقع التركيب داخل كل منطقة</p></div>
        <div class="header-actions">
          @if (access().canManage) { <button class="btn" type="button" (click)="openForm(null)" [disabled]="!regions().length">+ موقع جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>
      <app-devices-nav />

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="toolbar">
        <input class="search" type="search" placeholder="بحث باسم الموقع أو الوصف…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        <select [value]="regionId()" (change)="setRegion(+$any($event.target).value)" aria-label="تصفية حسب المنطقة">
          <option [value]="0">كل المناطق</option>
          @for (r of regions(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
        </select>
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>المواقع <span class="count">({{ filtered().length }})</span></h2></div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ search() || regionId() ? 'لا توجد نتائج' : 'لا توجد مواقع بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الموقع</th><th>المنطقة</th><th>الإحداثيات</th><th>الوصف</th><th>الأجهزة المركّبة</th>@if (access().canManage) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (s of filtered(); track s.id) {
                <tr>
                  <td><a class="cell-link cell-strong" [routerLink]="['/devices/sites', s.id]" title="تفاصيل الموقع">{{ s.name }}</a></td>
                  <td>{{ s.regionName }}</td>
                  <td>@if (coords(s.latitude, s.longitude); as c) { <span class="mono">{{ c }}</span> } @else { <span class="missing">⚠ بلا إحداثيات</span> }</td>
                  <td class="wrap">{{ s.description || '—' }}</td>
                  <td><a class="cell-link" [routerLink]="['/devices/installations']" [queryParams]="{ siteId: s.id }">{{ deviceCounts().get(s.id) ?? 0 }} جهاز ←</a></td>
                  @if (access().canManage) {
                    <td><div class="row-actions">
                      <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(s)">تعديل</button>
                      <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(s)">حذف</button>
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
      <app-modal [heading]="editing() ? 'تعديل الموقع' : 'موقع جديد'" size="lg" [busy]="saving()" (closed)="closeForm()">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-stack">
              @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
              <label class="form-field"><span class="form-label">اسم الموقع</span><input formControlName="name" maxlength="100"></label>
              <label class="form-field"><span class="form-label">المنطقة</span>
                <select formControlName="regionId"><option [ngValue]="0">اختر المنطقة</option>@for (r of regions(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }</select>
              </label>
              <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="500"></textarea></label>
              <div class="form-field"><span class="form-label">مكان الموقع على الخريطة</span>
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
export class SitesPage {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  access = this.service.access;
  coords = formatCoords;

  sites = signal<Site[]>([]);
  regions = signal<Region[]>([]);
  deviceCounts = signal(new Map<number, number>());
  search = signal('');
  regionId = signal(0);
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<Site | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const region = this.regionId();
    return this.sites().filter(s => (!region || s.regionId === region)
      && (!q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
  });

  form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    regionId: [0, Validators.min(1)],
    description: ['', Validators.maxLength(500)],
    // الإحداثيات إجبارية (خريطة سوريا) — تُحدَّد بالنقر على الخريطة أو يدوياً
    latitude: [null as number | null, Validators.required],
    longitude: [null as number | null, Validators.required]
  });

  setCoords(c: Coordinates) { this.form.patchValue(c); }

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed())
      .subscribe(p => this.regionId.set(Number(p.get('regionId')) || 0));
    this.load();
  }

  setRegion(id: number) {
    this.router.navigate([], { queryParams: { regionId: id || null }, queryParamsHandling: 'merge' });
  }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ sites: this.service.sites(), regions: this.service.regions(), installations: this.service.installations() }).subscribe({
      next: r => {
        this.sites.set(r.sites); this.regions.set(r.regions);
        this.deviceCounts.set(this.service.countBy(r.installations, i => i.siteId));
        this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(s: Site | null) {
    this.editing.set(s); this.formError.set('');
    this.form.reset({ name: s?.name ?? '', regionId: s?.regionId ?? (this.regionId() || 0), description: s?.description ?? '', latitude: s?.latitude ?? null, longitude: s?.longitude ?? null });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  async askDelete(s: Site) {
    if (!await this.confirm.ask(`حذف الموقع «${s.name}»؟ لا يمكن حذف موقع مركّب فيه أجهزة.`, 'حذف')) return;
    this.service.deleteSite(s.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = { name: (v.name ?? '').trim(), regionId: Number(v.regionId), description: (v.description ?? '').trim(), latitude: v.latitude!, longitude: v.longitude! };
    const s = this.editing();
    this.saving.set(true); this.formError.set('');
    (s ? this.service.updateSite(s.id, body) : this.service.createSite(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
