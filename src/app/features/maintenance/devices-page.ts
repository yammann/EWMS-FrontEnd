import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { MaintenanceService } from '@core/services/maintenance.service';
import { MaintenanceDevice, MaintenanceLookup } from '@core/models/maintenance.models';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { DeviceFormDialog } from './device-form-dialog';
import { DeviceRepairHistory } from './device-repair-history';

type SearchField = 'serialNumber' | 'model' | 'name';
const PAGE_SIZE = 20;

/**
 * أجهزة الصيانة (api/MaintenanceDevices): كل جهاز برقمه التسلسلي الفريد، وتحته سجل إصلاحاته
 * (MaintenanceRequests/GetAll?deviceMaintenanceId= — محصور بنطاق طلبات الصيانة لمن يراها).
 */
@Component({
  selector: 'app-maintenance-devices-page', standalone: true,
  imports: [Pager, Modal, DeviceFormDialog, DeviceRepairHistory],
  styleUrls: ['../shared/organization.scss', '../devices/devices.scss', './maintenance.scss', './requests-page.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">الصيانة</span><h1>أجهزة الصيانة</h1><p class="muted">كل جهاز برقمه التسلسلي، وسجل إصلاحاته كاملاً</p></div>
        <div class="header-actions">
          @if (can().createDevice) { <button class="btn" type="button" (click)="openForm(null)" [disabled]="!lookups()">+ جهاز جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="filters">
        <div class="filters-row">
          <div class="search-group">
            <select [value]="searchField()" (change)="searchField.set($any($event.target).value); searchText() && changed()" aria-label="البحث في">
              <option value="serialNumber">الرقم التسلسلي</option>
              <option value="model">الموديل</option>
              <option value="name">اسم الجهاز</option>
            </select>
            <input class="search" type="search" [placeholder]="searchField() === 'name' ? 'بحث بالاسم…' : 'يبدأ بـ…'" dir="auto"
                   [value]="searchText()" (input)="searchText.set($any($event.target).value); changed()" aria-label="بحث">
          </div>
          <select (change)="deviceTypeId.set(+$any($event.target).value); changed()" aria-label="نوع الجهاز">
            <option [value]="0" [selected]="!deviceTypeId()">كل الأنواع</option>
            @for (x of lookups()?.deviceTypes; track x.id) { <option [value]="x.id" [selected]="x.id === deviceTypeId()">{{ x.name }}</option> }
          </select>
          <select (change)="companyId.set(+$any($event.target).value); changed()" aria-label="الشركة">
            <option [value]="0" [selected]="!companyId()">كل الشركات</option>
            @for (x of lookups()?.companies; track x.id) { <option [value]="x.id" [selected]="x.id === companyId()">{{ x.name }}</option> }
          </select>
          @if (hasFilter()) { <button type="button" class="btn btn-ghost btn-sm" (click)="clearFilters()">مسح الفلاتر</button> }
        </div>
      </div>

      <section class="panel">
        @if (loading() && !rows().length) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!rows().length) {
          <div class="empty-state"><h3>{{ hasFilter() ? 'لا توجد نتائج مطابقة' : 'لا توجد أجهزة بعد' }}</h3>
            <p>{{ hasFilter() ? 'جرّب تعديل البحث أو الفلاتر.' : 'يُضاف الجهاز برقمه التسلسلي عند أول طلب صيانة له، أو من هنا.' }}</p></div>
        } @else {
          <div class="table-wrap" [class.dim]="loading()"><table>
            <thead><tr><th>الرقم التسلسلي</th><th>الجهاز</th><th>النوع والشركة</th><th>الموديل</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (d of rows(); track d.id) {
                <tr>
                  <td><span class="mono cell-strong">{{ d.serialNumber }}</span></td>
                  <td>{{ d.name || '—' }}@if (d.description) { <small>{{ d.description }}</small> }</td>
                  <td><span class="cell-strong">{{ d.deviceTypeName }}</span><small>{{ d.deviceCompanyName }}</small></td>
                  <td>@if (d.model) { <span class="mono">{{ d.model }}</span> } @else { <span class="muted-cell">—</span> }</td>
                  <td><div class="row-actions">
                    @if (can().viewRequests) { <button class="btn btn-ghost btn-sm" type="button" (click)="openHistory(d)">سجل الإصلاحات</button> }
                    @if (can().editDevice) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(d)" [disabled]="!lookups()">تعديل</button> }
                    @if (can().deleteDevice) { <button class="btn btn-danger btn-sm" type="button" (click)="remove(d)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
        }
      </section>
    </div>

    @if (formOpen() && lookups(); as l) {
      <app-device-form-dialog [device]="editing()" [lookups]="l" (saved)="saved($event)" (closed)="formOpen.set(false)" />
    }

    @if (history(); as h) {
      <app-modal [heading]="'سجل إصلاحات ' + (h.device.name || h.device.serialNumber)" [subheading]="h.device.serialNumber + ' · ' + h.device.deviceTypeName + ' · ' + h.device.deviceCompanyName"
                 size="lg" (closed)="history.set(null)">
        <div class="modal-body">
          <app-device-repair-history [deviceId]="h.device.id" [limit]="20" (navigated)="history.set(null)" />
        </div>
        <footer class="modal-actions"><button type="button" class="ghost" (click)="history.set(null)">إغلاق</button></footer>
      </app-modal>
    }`
})
export class MaintenanceDevicesPage {
  private service = inject(MaintenanceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  can = this.service.can;
  pageSize = PAGE_SIZE;

  lookups = signal<{ deviceTypes: MaintenanceLookup[]; companies: MaintenanceLookup[] } | null>(null);
  rows = signal<MaintenanceDevice[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');

  searchField = signal<SearchField>('serialNumber');
  searchText = signal('');
  deviceTypeId = signal(0);
  companyId = signal(0);
  hasFilter = computed(() => !!(this.searchText().trim() || this.deviceTypeId() || this.companyId()));

  formOpen = signal(false);
  editing = signal<MaintenanceDevice | null>(null);
  history = signal<{ device: MaintenanceDevice } | null>(null);

  private search$ = new Subject<void>();

  constructor() {
    forkJoin({
      deviceTypes: this.service.lookup('deviceTypes'),
      companies: this.service.lookup('companies')
    }).subscribe({ next: l => this.lookups.set(l), error: e => this.error.set(e.message) });
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => { this.page.set(1); this.load(); });
    this.load();
  }

  changed() { this.search$.next(); }

  clearFilters() {
    this.searchText.set(''); this.deviceTypeId.set(0); this.companyId.set(0);
    this.page.set(1); this.load();
  }

  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    const text = this.searchText().trim();
    this.loading.set(true); this.error.set('');
    this.service.devices({
      [this.searchField()]: text || undefined,
      deviceTypeId: this.deviceTypeId() || null,
      deviceCompanyId: this.companyId() || null,
      page: this.page(), pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }

  openForm(device: MaintenanceDevice | null) { this.editing.set(device); this.formOpen.set(true); }

  saved(device: MaintenanceDevice) {
    this.formOpen.set(false);
    this.toast.success(this.editing() ? 'تم حفظ الجهاز' : 'أُضيف الجهاز ' + device.serialNumber);
    this.load();
  }

  async remove(device: MaintenanceDevice) {
    if (!await this.confirm.ask('حذف الجهاز «' + device.serialNumber + '»؟ لا يُحذف جهاز له طلبات صيانة.', 'حذف')) return;
    this.service.deleteDevice(device.id).subscribe({
      next: r => { this.toast.success(r.message); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }

  openHistory(device: MaintenanceDevice) { this.history.set({ device }); }
}
