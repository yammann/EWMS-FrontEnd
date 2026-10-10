import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, forkJoin, merge, of, switchMap } from 'rxjs';
import { DeviceService, saveBlob } from '../data-access/device.service';
import { Device, DeviceSite, INSTALLATION_STATUSES, InstallationStatus, IpInUse, Site } from '../data-access/device.models';
import { GOVERNORATES } from '@core/constants/governorates';
import { deviceUrl, ipv4Validator, isIpv4, isSubnetMask, macValidator, sameSubnet, subnetValidator } from '@core/utils/network';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { CopyText } from '@shared/ui/secret-text';
import { Pager } from '@shared/ui/pager';
import { DeviceHistory, DevicePassword, InstallStatus, InstallationsImport } from '../components/device-ui';
import { localDateInput } from '@core/utils/format';
import { Alert } from '@shared/ui/alert';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { trackRequest } from '@shared/ui/loader';
import { FormActions } from '@shared/ui/form-actions';
import { SelectValue } from '@shared/ui/select-value';

const PAGE_SIZE = 50;

/** البوابة (اختيارية) داخل شبكة الجهاز */
function gatewayInSubnet(group: AbstractControl): ValidationErrors | null {
  const { ip, subnetMask, gateway } = group.value as { ip: string; subnetMask: string; gateway: string };
  if (!gateway?.trim() || !isIpv4(ip) || !isSubnetMask(subnetMask) || !isIpv4(gateway)) return null;
  return sameSubnet(ip, gateway, subnetMask) ? null : { gatewaySubnet: true };
}

/**
 * التركيبات: أي جهاز في أي موقع مع بيانات الشبكة والتشغيل. البحث والتقسيم في الخادم، وكلمة السر لا تصل مع القائمة —
 * تُجلب عند «إظهار» أو «نسخ» بصلاحية مستقلة ويُسجَّل كل إظهار (مراجعة 2026-10-05).
 */
@Component({
  selector: 'app-installations-page', standalone: true,
  imports: [SelectValue, FormActions, PageHeader, EmptyState, Alert, DatePipe, ReactiveFormsModule, Modal, CopyText, Pager, DevicePassword, InstallStatus, DeviceHistory, InstallationsImport],
  styleUrls: ['../../../shared/styles/page-base.scss', '../../../shared/styles/data-tools.scss'],
  templateUrl: './installations-page.html',
  styles: [`
    .secret input { flex: 1; }
    td small { display: block; }
    tr.removed td { opacity: .6; }
    .open-link { text-decoration: none; font-weight: 700; padding: 0 4px; color: var(--brand-700); }
    .dup { font-size: 11px; font-weight: 800; color: var(--warning-700); background: var(--warning-50); border: 1px solid var(--warning-300); border-radius: 999px; padding: 1px 8px; }
    .dup-warning { display: grid; gap: 2px; margin-top: 4px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--warning-50); color: var(--warning-700); font-size: 12px; font-weight: 700; }
  `]
})
export class InstallationsPage {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  access = this.service.access;

  pageSize = PAGE_SIZE;
  governorates = GOVERNORATES;
  statuses = INSTALLATION_STATUSES;
  today = localDateInput();
  url = deviceUrl;

  rows = signal<DeviceSite[]>([]);
  total = signal(0);
  page = signal(1);
  sites = signal<Site[]>([]);
  devices = signal<Device[]>([]);
  search = signal('');
  governorate = signal(''); siteId = signal(0); deviceId = signal(0); status = signal(0);
  loading = signal(false); saving = signal(false); exporting = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<DeviceSite | null>(null);
  showPass = signal(false);
  history = signal<DeviceSite | null>(null);
  importOpen = signal(false);
  duplicates = signal<IpInUse[]>([]);

  search$ = new Subject<void>();

  sitesInGovernorate = computed(() => this.governorate() ? this.sites().filter(s => s.governorateCode === this.governorate()) : this.sites());
  /** مواقع نموذج التركيب مجمّعة بمحافظتها (تظهر المحافظات التي فيها مواقع فقط) */
  siteGroups = computed(() => [...GOVERNORATES, { code: '', name: 'بلا محافظة' }]
    .map(g => ({ code: g.code, name: g.name, sites: this.sites().filter(s => s.governorateCode === g.code) })).filter(g => g.sites.length));
  hasFilter = computed(() => !!(this.search().trim() || this.governorate() || this.siteId() || this.deviceId() || this.status()));

  form = inject(FormBuilder).nonNullable.group({
    deviceId: [0, Validators.min(1)],
    siteId: [0, Validators.min(1)],
    ip: ['', [Validators.required, ipv4Validator]],
    subnetMask: ['255.255.255.0', [Validators.required, subnetValidator]],
    gateway: ['', ipv4Validator],
    userName: ['', [Validators.required, Validators.maxLength(100)]],
    pass: ['', Validators.maxLength(200)],
    note: ['', Validators.maxLength(1000)],
    installLocation: ['', Validators.maxLength(300)],
    sn: ['', Validators.maxLength(100)],
    macAddress: ['', macValidator],
    port: ['', Validators.maxLength(50)],
    vlan: [null as number | null, [Validators.min(1), Validators.max(4094)]],
    firmware: ['', Validators.maxLength(100)],
    installDate: [''],
    status: [1 as InstallationStatus]
  }, { validators: gatewayInSubnet });

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.governorate.set(p.get('governorate') ?? '');
      this.siteId.set(Number(p.get('siteId')) || 0);
      this.deviceId.set(Number(p.get('deviceId')) || 0);
      this.status.set(Number(p.get('status')) || 0);
      this.page.set(1);
      this.load();
    });
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => { this.page.set(1); this.load(); });

    // تنبيه تكرار الـ IP في الموقع أثناء الكتابة (من الخادم — القائمة لم تعد كلها في المتصفح)
    merge(this.form.controls.ip.valueChanges, this.form.controls.siteId.valueChanges).pipe(
      debounceTime(350),
      switchMap(() => {
        const { ip, siteId } = this.form.getRawValue();
        return siteId && isIpv4(ip) ? this.service.ipInUse(siteId, ip.trim(), this.editing()?.id ?? null) : of([]);
      }),
      takeUntilDestroyed()
    ).subscribe({ next: list => this.duplicates.set(list), error: () => this.duplicates.set([]) });

    forkJoin({ sites: this.service.sites(), devices: this.service.devices() }).subscribe({
      next: r => { this.sites.set(r.sites); this.devices.set(r.devices); },
      error: e => this.error.set(e.message)
    });
  }

  join(...parts: (string | null | undefined)[]) { return parts.filter(p => !!p).join(' · '); }

  private filter() {
    return {
      q: this.search().trim() || undefined, governorateCode: this.governorate() || null,
      siteId: this.siteId() || null, deviceId: this.deviceId() || null, status: this.status() || null
    };
  }

  setFilter(changes: Record<string, number | string | null>) {
    this.router.navigate([], { queryParams: changes, queryParamsHandling: 'merge' });
  }

  goTo(page: number) { this.page.set(page); this.load(); }

  load() {
    trackRequest(this.service.installations({ ...this.filter(), page: this.page(), pageSize: PAGE_SIZE }), this.loading, this.error, r => { this.rows.set(r.items); this.total.set(r.totalCount); });
  }

  export() {
    this.exporting.set(true);
    this.service.exportInstallations(this.filter()).subscribe({
      next: blob => { this.exporting.set(false); saveBlob(blob, `تركيبات-الأجهزة-${this.today}.xlsx`); },
      error: e => { this.exporting.set(false); this.toast.error(e.message); }
    });
  }

  imported(count: number) {
    this.toast.success(`استُورد ${count} تركيباً`);
    this.load();
    this.service.devices().subscribe({ next: d => this.devices.set(d), error: () => { } });
  }

  openForm(i: DeviceSite | null) {
    this.editing.set(i); this.formError.set(''); this.showPass.set(false); this.duplicates.set([]);
    this.form.reset({
      deviceId: i?.deviceId ?? (this.deviceId() || 0),
      siteId: i?.siteId ?? (this.siteId() || 0),
      ip: i?.ip ?? '', subnetMask: i?.subnetMask ?? '255.255.255.0', gateway: i?.gateway ?? '',
      userName: i?.userName ?? '', pass: '', note: i?.note ?? '', installLocation: i?.installLocation ?? '', sn: i?.sn ?? '',
      macAddress: i?.macAddress ?? '', port: i?.port ?? '', vlan: i?.vlan ?? null, firmware: i?.firmware ?? '',
      installDate: i?.installDate ? i.installDate.slice(0, 10) : '', status: i?.status ?? 1
    });
    // كلمة السر مطلوبة عند الإضافة فقط (عند التعديل فارغة = تبقى الحالية)
    this.form.controls.pass.setValidators(i ? [Validators.maxLength(200)] : [Validators.required, Validators.maxLength(200)]);
    this.form.controls.pass.updateValueAndValidity();
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }

  async askDelete(i: DeviceSite) {
    const hint = i.status === 3 ? '' : ' إن كان الجهاز قد فُكّ فاستخدم الحالة «أُزيل» بدل الحذف ليبقى سجله.';
    if (!await this.confirm.ask(`حذف تركيب «${i.deviceName}» في «${i.siteName}» (${i.ip})؟${hint}`, 'حذف')) return;
    this.service.deleteInstallation(i.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }

  verify(i: DeviceSite) {
    this.service.verifyInstallation(i.id).subscribe({
      next: updated => { this.toast.success('سُجّل التحقق اليوم'); this.rows.update(list => list.map(r => r.id === updated.id ? updated : r)); },
      error: e => this.toast.error(e.message)
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const i = this.editing();
    const body = {
      deviceId: Number(v.deviceId), siteId: Number(v.siteId), ip: v.ip.trim(), subnetMask: v.subnetMask.trim(), gateway: v.gateway.trim(),
      userName: v.userName.trim(), pass: v.pass, note: v.note.trim(), installLocation: v.installLocation.trim(), sn: v.sn.trim(),
      macAddress: v.macAddress.trim(), port: v.port.trim(), vlan: v.vlan ? Number(v.vlan) : null, firmware: v.firmware.trim(),
      installDate: v.installDate || null, status: Number(v.status) as InstallationStatus, rowVersion: i?.rowVersion ?? null
    };
    trackRequest((i ? this.service.updateInstallation(i.id, body) : this.service.createInstallation(body)), this.saving, this.formError, () => { this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); });
  }
}
