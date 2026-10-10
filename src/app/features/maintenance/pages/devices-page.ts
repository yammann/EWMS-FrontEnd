import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, forkJoin } from 'rxjs';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceDevice, MaintenanceLookup } from '../data-access/maintenance.models';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { Modal } from '@shared/ui/modal';
import { Pager } from '@shared/ui/pager';
import { DeviceFormDialog } from '../components/device-form-dialog';
import { DeviceRepairHistory } from '../components/device-repair-history';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';
import { SelectValue } from '@shared/ui/select-value';

type SearchField = 'serialNumber' | 'model' | 'name';
const PAGE_SIZE = 20;

/**
 * أجهزة الصيانة (api/MaintenanceDevices): كل جهاز برقمه التسلسلي الفريد، وتحته سجل إصلاحاته
 * (MaintenanceRequests/GetAll?deviceMaintenanceId= — محصور بنطاق طلبات الصيانة لمن يراها).
 */
@Component({
  selector: 'app-maintenance-devices-page', standalone: true,
  imports: [SelectValue, PageHeader, EmptyState, Alert, Pager, Modal, DeviceFormDialog, DeviceRepairHistory],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss', '../../../shared/styles/list-tools.scss', './requests-page.scss'],
  templateUrl: './devices-page.html'
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
  setSearchField(value: string) { this.searchField.set(value as SearchField); }
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
    trackRequest(this.service.devices({ [this.searchField()]: text || undefined, deviceTypeId: this.deviceTypeId() || null, deviceCompanyId: this.companyId() || null, page: this.page(), pageSize: PAGE_SIZE }), this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
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
