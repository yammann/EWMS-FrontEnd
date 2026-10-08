import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, forkJoin, merge, of, switchMap } from 'rxjs';
import { DeviceService, saveBlob } from '@core/services/device.service';
import { Device, DeviceSite, INSTALLATION_STATUSES, InstallationStatus, IpInUse, Site } from '@core/models/device.models';
import { GOVERNORATES } from '@core/constants/governorates';
import { deviceUrl, ipv4Validator, isIpv4, isSubnetMask, macValidator, sameSubnet, subnetValidator } from '@core/utils/network';
import { Modal } from '@shared/ui/modal';
import { ToastService } from '@shared/ui/toast.service';
import { ConfirmService } from '@shared/ui/confirm.service';
import { CopyText } from '@shared/ui/secret-text';
import { Pager } from '@features/maintenance/maintenance-ui';
import { DeviceHistory, DevicePassword, InstallStatus, InstallationsImport } from './device-ui';

const PAGE_SIZE = 50;

/** البوابة (اختيارية) داخل شبكة الجهاز */
function gatewayInSubnet(group: AbstractControl): ValidationErrors | null {
  const { ip, subnetMask, gateway } = group.value as { ip: string; subnetMask: string; gateway: string };
  if (!gateway?.trim() || !isIpv4(ip) || !isSubnetMask(subnetMask) || !isIpv4(gateway)) return null;
  return sameSubnet(ip, gateway, subnetMask) ? null : { gatewaySubnet: true };
}

function todayInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/**
 * التركيبات: أي جهاز في أي موقع مع بيانات الشبكة والتشغيل. البحث والتقسيم في الخادم، وكلمة السر لا تصل مع القائمة —
 * تُجلب عند «إظهار» أو «نسخ» بصلاحية مستقلة ويُسجَّل كل إظهار (مراجعة 2026-10-05).
 */
@Component({
  selector: 'app-installations-page', standalone: true,
  imports: [DatePipe, ReactiveFormsModule, Modal, CopyText, Pager, DevicePassword, InstallStatus, DeviceHistory, InstallationsImport],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>تركيبات الأجهزة</h1><p class="muted">الأجهزة المركّبة في مواقع المؤسسة وبيانات الاتصال بها</p></div>
        <div class="header-actions">
          @if (access().canCreate) {
            <button class="btn" type="button" (click)="openForm(null)" [disabled]="!devices().length || !sites().length">+ تركيب جديد</button>
            <button class="btn btn-ghost" type="button" (click)="importOpen.set(true)">استيراد Excel</button>
          }
          <button class="btn btn-ghost" type="button" (click)="export()" [disabled]="exporting() || !total()">{{ exporting() ? 'جارٍ التصدير…' : 'تصدير Excel' }}</button>
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="toolbar">
        <input class="search" type="search" placeholder="بحث بالـ IP أو الجهاز أو الرقم التسلسلي أو MAC أو مكان التركيب…" [value]="search()"
               (input)="search.set($any($event.target).value); search$.next()" aria-label="بحث">
        <select [value]="governorate()" (change)="setFilter({ governorate: $any($event.target).value || null, siteId: null })" aria-label="المحافظة">
          <option value="">كل المحافظات</option>
          @for (g of governorates; track g.code) { <option [value]="g.code">{{ g.name }}</option> }
        </select>
        <select [value]="siteId()" (change)="setFilter({ siteId: +$any($event.target).value || null })" aria-label="الموقع">
          <option [value]="0">كل المواقع</option>
          @for (s of sitesInGovernorate(); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
        </select>
        <select [value]="deviceId()" (change)="setFilter({ deviceId: +$any($event.target).value || null })" aria-label="الجهاز">
          <option [value]="0">كل الأجهزة</option>
          @for (d of devices(); track d.id) { <option [value]="d.id">{{ d.name }}@if (d.model) { — {{ d.model }} }</option> }
        </select>
        <select [value]="status()" (change)="setFilter({ status: +$any($event.target).value || null })" aria-label="الحالة">
          <option [value]="0">كل الحالات</option>
          @for (s of statuses; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
        </select>
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>التركيبات <span class="count">({{ total() }})</span></h2></div>
        @if (loading() && !rows().length) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!rows().length) { <p class="empty-state">{{ hasFilter() ? 'لا توجد نتائج' : 'لا توجد تركيبات بعد' }}</p> }
        @else {
          <div class="table-wrap" [class.dim]="loading()"><table>
            <thead><tr><th>الجهاز</th><th>الموقع</th><th>الشبكة</th><th>المستخدم</th><th>كلمة السر</th><th>الحالة</th><th class="actions-th"></th></tr></thead>
            <tbody>
              @for (i of rows(); track i.id) {
                <tr [class.removed]="i.status === 3">
                  <td><span class="cell-strong">{{ i.deviceName }}</span><small>{{ join(i.deviceModel, i.sn ? 'SN: ' + i.sn : '', i.firmware ? 'FW ' + i.firmware : '') || '—' }}</small></td>
                  <td><span class="cell-strong">{{ i.siteName }}</span><small>{{ join(i.governorateName, i.installLocation) }}</small></td>
                  <td>
                    <app-copy-text [value]="i.ip" label="IP">
                      <a class="open-link" [href]="url(i.ip)" target="_blank" rel="noopener noreferrer" title="فتح واجهة الجهاز في المتصفح" aria-label="فتح واجهة الجهاز">↗</a>
                      @if (i.duplicateIp) { <span class="dup" title="يوجد أكثر من تركيب بنفس الـ IP في هذا الموقع">⚠ مكرر</span> }
                    </app-copy-text>
                    <small class="mono">{{ join(i.subnetMask, i.gateway ? 'GW ' + i.gateway : '') }}</small>
                    @if (i.macAddress || i.port || i.vlan) { <small class="mono">{{ join(i.macAddress, i.port ? 'Port ' + i.port : '', i.vlan ? 'VLAN ' + i.vlan : '') }}</small> }
                  </td>
                  <td><app-copy-text [value]="i.userName" label="اسم المستخدم" /></td>
                  <td><app-device-password [installationId]="i.id" [hasPassword]="i.hasPassword" /></td>
                  <td><app-install-status [status]="i.status" />
                    <small>{{ i.lastVerifiedAt ? 'تحقق ' + (i.lastVerifiedAt | date:'yyyy/MM/dd') : 'لم يُتحقق بعد' }}</small></td>
                  <td><div class="row-actions">
                    @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="verify(i)" title="تأكيد أن بيانات التركيب صحيحة اليوم">✓ تحققت</button> }
                    <button class="btn btn-ghost btn-sm" type="button" (click)="history.set(i)">السجل</button>
                    @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(i)">تعديل</button> }
                    @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(i)">حذف</button> }
                  </div></td>
                </tr>
              }
            </tbody>
          </table></div>
          <app-pager [sizes]="[]" [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="loading()" (pageChange)="goTo($event)" />
        }
      </section>
    </div>

    @if (formOpen()) {
      <app-modal [heading]="editing() ? 'تعديل التركيب' : 'تركيب جهاز في موقع'" size="lg" [busy]="saving()" (closed)="closeForm()">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body form-grid-2">
            @if (formError()) { <p class="alert alert-error full" role="alert">{{ formError() }}</p> }
            <label class="form-field"><span class="form-label">الجهاز</span>
              <select formControlName="deviceId"><option [ngValue]="0">اختر الجهاز</option>
                @for (d of devices(); track d.id) { <option [ngValue]="d.id">{{ d.name }}@if (d.model) { ({{ d.model }}) }</option> }
              </select></label>
            <label class="form-field"><span class="form-label">الموقع</span>
              <select formControlName="siteId"><option [ngValue]="0">اختر الموقع</option>
                @for (g of siteGroups(); track g.code) {
                  <optgroup [label]="g.name">@for (s of g.sites; track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }</optgroup>
                }
              </select></label>
            <label class="form-field"><span class="form-label">الرقم التسلسلي <small class="hint">(اختياري)</small></span><input formControlName="sn" maxlength="100" dir="ltr"></label>
            <label class="form-field"><span class="form-label">مكان التركيب <small class="hint">(اختياري — مثل: عند البوابة الرئيسية)</small></span><input formControlName="installLocation" maxlength="300"></label>

            <label class="form-field"><span class="form-label">عنوان IP</span><input formControlName="ip" dir="ltr" placeholder="192.168.1.10">
              @if (form.controls.ip.touched && form.controls.ip.invalid) { <small class="form-error">صيغة IPv4 غير صحيحة (بلا أصفار بادئة)</small> }
              @if (duplicates().length) {
                <small class="dup-warning" role="status">⚠ هذا الـ IP مستخدم في نفس الموقع:
                  @for (d of duplicates(); track d.id) { <span>{{ d.deviceName }}{{ d.installLocation ? ' — ' + d.installLocation : '' }}</span> }
                  — يمكنك الحفظ رغم ذلك.</small>
              }</label>
            <label class="form-field"><span class="form-label">قناع الشبكة (Subnet Mask)</span><input formControlName="subnetMask" dir="ltr" placeholder="255.255.255.0">
              @if (form.controls.subnetMask.touched && form.controls.subnetMask.invalid) { <small class="form-error">قناع غير صحيح — آحاد متصلة ثم أصفار، مثل 255.255.255.0</small> }</label>
            <label class="form-field"><span class="form-label">البوابة (Gateway) <small class="hint">(اختياري)</small></span><input formControlName="gateway" dir="ltr" placeholder="192.168.1.1">
              @if (form.controls.gateway.invalid) { <small class="form-error">صيغة IPv4 غير صحيحة</small> }
              @else if (form.hasError('gatewaySubnet')) { <small class="form-error">البوابة ليست في شبكة الجهاز</small> }</label>
            <label class="form-field"><span class="form-label">عنوان MAC <small class="hint">(اختياري)</small></span><input formControlName="macAddress" dir="ltr" maxlength="17" placeholder="AA:BB:CC:DD:EE:FF">
              @if (form.controls.macAddress.invalid) { <small class="form-error">12 خانة سداسية</small> }</label>
            <label class="form-field"><span class="form-label">منفذ السويتش <small class="hint">(اختياري)</small></span><input formControlName="port" dir="ltr" maxlength="50" placeholder="Gi0/12"></label>
            <label class="form-field"><span class="form-label">VLAN <small class="hint">(اختياري)</small></span><input type="number" formControlName="vlan" min="1" max="4094" dir="ltr">
              @if (form.controls.vlan.invalid) { <small class="form-error">بين 1 و4094</small> }</label>

            <label class="form-field"><span class="form-label">اسم المستخدم</span><input formControlName="userName" dir="ltr" maxlength="100" autocomplete="off"></label>
            <label class="form-field"><span class="form-label">كلمة السر @if (editing()) { <small class="hint">(اتركها فارغة للإبقاء على الحالية)</small> }</span>
              <span class="secret">
                <input formControlName="pass" dir="ltr" maxlength="200" [type]="showPass() ? 'text' : 'password'" autocomplete="new-password">
                <button type="button" class="icon-btn-sm" (click)="showPass.set(!showPass())" [attr.aria-label]="showPass() ? 'إخفاء' : 'إظهار'">{{ showPass() ? '🙈' : '👁' }}</button>
              </span></label>
            <label class="form-field"><span class="form-label">إصدار البرنامج الثابت <small class="hint">(اختياري)</small></span><input formControlName="firmware" dir="ltr" maxlength="100"></label>
            <label class="form-field"><span class="form-label">تاريخ التركيب <small class="hint">(اختياري)</small></span><input type="date" formControlName="installDate" [max]="today"></label>
            <label class="form-field"><span class="form-label">الحالة</span>
              <select formControlName="status">@for (s of statuses; track s.value) { <option [ngValue]="s.value">{{ s.label }}</option> }</select>
              <small class="hint">«أُزيل» للأجهزة المفكوكة مع بقاء سجلها؛ الحذف لأخطاء الإدخال فقط</small></label>
            <label class="form-field full"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span><textarea formControlName="note" rows="3" maxlength="1000"></textarea></label>
          </div>
          <footer class="modal-actions">
            <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
          </footer>
        </form>
      </app-modal>
    }

    @if (history(); as h) { <app-device-history kind="installation" [entityId]="h.id" [title]="h.deviceName + ' في ' + h.siteName + ' — ' + h.ip" (closed)="history.set(null)" /> }
    @if (importOpen()) { <app-installations-import (imported)="imported($event)" (closed)="importOpen.set(false)" /> }
`,
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
  today = todayInput();
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
    this.loading.set(true); this.error.set('');
    this.service.installations({ ...this.filter(), page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
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
    this.saving.set(true); this.formError.set('');
    (i ? this.service.updateInstallation(i.id, body) : this.service.createInstallation(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }
}
