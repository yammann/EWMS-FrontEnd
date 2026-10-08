import { Pagination } from '@core/utils/pagination';
import { Pager } from '@shared/ui/pager';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DeviceService, formatCoords } from '@core/services/device.service';
import { CoordinatePicker, Coordinates } from '@features/map/coordinate-picker';
import { Site } from '@core/models/device.models';
import { GOVERNORATES } from '@core/constants/governorates';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { formatPhone, isValidPhone, normalizePhone } from '@core/utils/phone';
import { DeviceHistory } from './device-ui';

/** المواقع — لكل موقع إحداثيات تظهر على خريطة سوريا، والمحافظة (المنطقة) تُحدَّد تلقائياً من النقطة المختارة */
@Component({
  selector: 'app-sites-page', standalone: true, imports: [ReactiveFormsModule, RouterLink, CoordinatePicker, Modal, DeviceHistory, Pager],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>المواقع</h1><p class="muted">مواقع التركيب — تُحدَّد محافظة كل موقع تلقائياً من مكانه على الخريطة</p></div>
        <div class="header-actions">
          @if (access().canCreate) { <button class="btn" type="button" (click)="openForm(null)">+ موقع جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="toolbar">
        <input class="search" type="search" placeholder="بحث باسم الموقع أو الوصف أو المسؤول…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
        <select [value]="governorate()" (change)="setGovernorate($any($event.target).value)" aria-label="تصفية حسب المحافظة">
          <option value="">كل المحافظات</option>
          @for (g of governorates; track g.code) { <option [value]="g.code">{{ g.name }}</option> }
        </select>
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>المواقع <span class="count">({{ filtered().length }})</span></h2></div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ search() || governorate() ? 'لا توجد نتائج' : 'لا توجد مواقع بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الموقع</th><th>المحافظة</th><th>الإحداثيات</th><th>المسؤول</th><th>الأجهزة المركّبة</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (s of pager.items(); track s.id) {
                <tr>
                  <td><a class="cell-link cell-strong" [routerLink]="['/devices/sites', s.id]" title="تفاصيل الموقع">{{ s.name }}</a>@if (s.description) { <small>{{ s.description }}</small> }</td>
                  <td>{{ s.governorateName || "—" }}</td>
                  <td>@if (coords(s.latitude, s.longitude); as c) { <span class="mono">{{ c }}</span> } @else { <span class="missing">⚠ بلا إحداثيات</span> }</td>
                  <td>@if (s.contactName || s.contactPhone || s.responsibleParty) {
                      {{ s.contactName || '—' }}@if (s.contactPhone) { <small class="mono" dir="ltr">{{ phone(s.contactPhone) }}</small> }@if (s.responsibleParty) { <small>{{ s.responsibleParty }}</small> }
                    } @else { <span class="muted-cell">—</span> }</td>
                  <td><a class="cell-link" [routerLink]="['/devices/installations']" [queryParams]="{ siteId: s.id }">{{ s.installationsCount }} تركيب ←</a>
                    @if (s.installationsCount !== s.activeInstallationsCount) { <small>{{ s.activeInstallationsCount }} يعمل</small> }</td>
                  <td><div class="row-actions">
                    <button class="btn btn-ghost btn-sm" type="button" (click)="history.set(s)">السجل</button>
                    @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(s)">تعديل</button> }
                    @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(s)">حذف</button> }
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
      <app-modal [heading]="editing() ? 'تعديل الموقع' : 'موقع جديد'" size="lg" [busy]="saving()" (closed)="closeForm()">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body form-stack">
              @if (formError()) { <p class="alert alert-error" role="alert">{{ formError() }}</p> }
              <label class="form-field"><span class="form-label">اسم الموقع</span><input formControlName="name" maxlength="100"></label>
              <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="500"></textarea></label>
              <div class="form-grid-2">
                <label class="form-field"><span class="form-label">مسؤول الموقع <small class="hint">(اختياري)</small></span><input formControlName="contactName" maxlength="100"></label>
                <label class="form-field"><span class="form-label">هاتف المسؤول <small class="hint">(اختياري)</small></span><input formControlName="contactPhone" dir="ltr" maxlength="20" inputmode="tel" placeholder="0933 123 456">
                  @if (form.controls.contactPhone.invalid) { <small class="form-error">رقم غير صحيح — جوال 09 ثم 8 أرقام، أو أرضي مع رمز المحافظة</small> }</label>
                <label class="form-field full"><span class="form-label">الجهة المسؤولة <small class="hint">(اختياري — فرع أو قسم أو جهة خارجية)</small></span><input formControlName="responsibleParty" maxlength="150"></label>
              </div>
              <div class="form-field"><span class="form-label">مكان الموقع على الخريطة <small class="hint">(تُحدَّد المحافظة تلقائياً من النقطة)</small></span>
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

    @if (history(); as h) { <app-device-history kind="site" [entityId]="h.id" [title]="h.name" (closed)="history.set(null)" /> }
`,
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
    this.loading.set(true); this.error.set('');
    this.service.sites().subscribe({
      next: sites => { this.sites.set(sites); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
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
    this.saving.set(true); this.formError.set('');
    (s ? this.service.updateSite(s.id, body) : this.service.createSite(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
