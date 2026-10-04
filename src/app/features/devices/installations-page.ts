import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';
import { Device, DeviceSite, Site } from '../../core/models/device.models';
import { GOVERNORATES } from '../../core/constants/governorates';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { CopyText, SecretText } from '../../shared/ui/secret-text';

const IPV4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/**
 * التركيبات: أي جهاز في أي موقع مع بيانات الاتصال (IP / Subnet / المستخدم / كلمة السر).
 * كلمة السر مخفية افتراضياً مع زر إظهار ونسخ لكل من يشاهد (قرار المستخدم 2026-09-28).
 */
@Component({
  selector: 'app-installations-page', standalone: true, imports: [ReactiveFormsModule, Modal, CopyText, SecretText],
  styleUrls: ['../shared/organization.scss', './devices.scss'],
  template: `
    <div class="page">
      <header class="page-header">
        <div><span class="eyebrow">توثيق الأجهزة</span><h1>تركيبات الأجهزة</h1><p class="muted">الأجهزة المركّبة في مواقع المؤسسة وبيانات الاتصال بها</p></div>
        <div class="header-actions">
          @if (access().canCreate) { <button class="btn" type="button" (click)="openForm(null)" [disabled]="!devices().length || !sites().length">+ تركيب جديد</button> }
          <button class="btn btn-ghost" type="button" (click)="load()" [disabled]="loading()">تحديث</button>
        </div>
      </header>

      @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }

      <div class="toolbar">
        <input class="search" type="search" placeholder="بحث بالـ IP أو الجهاز أو الرقم التسلسلي أو مكان التركيب…" [value]="search()" (input)="search.set($any($event.target).value)" aria-label="بحث">
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
      </div>

      <section class="panel">
        <div class="panel-heading"><h2>التركيبات <span class="count">({{ filtered().length }})</span></h2></div>
        @if (loading()) { <p class="empty-state" role="status">جارٍ التحميل…</p> }
        @else if (!filtered().length) { <p class="empty-state">{{ hasFilter() ? 'لا توجد نتائج' : 'لا توجد تركيبات بعد' }}</p> }
        @else {
          <div class="table-wrap"><table>
            <thead><tr><th>الجهاز</th><th>الموقع</th><th>مكان التركيب</th><th>IP</th><th>Subnet Mask</th><th>المستخدم</th><th>كلمة السر</th><th>ملاحظات</th>@if (access().canEdit || access().canDelete) { <th class="actions-th"></th> }</tr></thead>
            <tbody>
              @for (i of filtered(); track i.id) {
                <tr>
                  <td><span class="cell-strong">{{ i.deviceName }}</span><small>{{ join(i.deviceModel, i.sn ? 'SN: ' + i.sn : '') || '—' }}</small></td>
                  <td><span class="cell-strong">{{ i.siteName }}</span><small>{{ i.governorateName }}</small></td>
                  <td class="wrap">{{ i.installLocation || '—' }}</td>
                  <td><app-copy-text [value]="i.ip" label="IP">@if (isDuplicate(i)) { <span class="dup" title="يوجد أكثر من تركيب بنفس الـ IP في هذا الموقع">⚠ مكرر</span> }</app-copy-text></td>
                  <td><span class="mono">{{ i.subnetMask }}</span></td>
                  <td><app-copy-text [value]="i.userName" label="اسم المستخدم" /></td>
                  <td><app-secret-text [value]="i.pass" /></td>
                  <td class="wrap">{{ i.note || '—' }}</td>
                  @if (access().canEdit || access().canDelete) {
                    <td><div class="row-actions">
                      @if (access().canEdit) { <button class="btn btn-ghost btn-sm" type="button" (click)="openForm(i)">تعديل</button> }
                      @if (access().canDelete) { <button class="btn btn-danger btn-sm" type="button" (click)="askDelete(i)">حذف</button> }
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
                @if (form.controls.ip.touched && form.controls.ip.invalid) { <small class="form-error">صيغة IPv4 غير صحيحة</small> }
                @if (formDuplicates().length) {
                  <small class="dup-warning" role="status">⚠ هذا الـ IP مستخدم في نفس الموقع:
                    @for (d of formDuplicates(); track d.id) { <span>{{ d.deviceName }}{{ d.installLocation ? ' — ' + d.installLocation : '' }}</span> }
                    — يمكنك الحفظ رغم ذلك.</small>
                }</label>
              <label class="form-field"><span class="form-label">Subnet Mask</span><input formControlName="subnetMask" dir="ltr" placeholder="255.255.255.0">
                @if (form.controls.subnetMask.touched && form.controls.subnetMask.invalid) { <small class="form-error">صيغة غير صحيحة</small> }</label>
              <label class="form-field"><span class="form-label">اسم المستخدم</span><input formControlName="userName" dir="ltr" maxlength="100" autocomplete="off"></label>
              <label class="form-field"><span class="form-label">كلمة السر</span>
                <span class="secret">
                  <input formControlName="pass" dir="ltr" maxlength="200" [type]="showPass() ? 'text' : 'password'" autocomplete="new-password">
                  <button type="button" class="icon-btn-sm" (click)="showPass.set(!showPass())" [attr.aria-label]="showPass() ? 'إخفاء' : 'إظهار'">{{ showPass() ? '🙈' : '👁' }}</button>
                </span></label>
              <label class="form-field full"><span class="form-label">ملاحظات <small class="hint">(اختياري)</small></span><textarea formControlName="note" rows="3" maxlength="1000"></textarea></label>
            </div>
            <footer class="modal-actions">
              <button type="button" class="ghost" (click)="closeForm()" [disabled]="saving()">إلغاء</button>
              <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ' }}</button>
            </footer>
          </form>
      </app-modal>
    }
`,
  styles: [`.secret input { flex: 1; } .dup { font-size: 11px; font-weight: 800; color: var(--warning-700); background: var(--warning-50); border: 1px solid var(--warning-300); border-radius: 999px; padding: 1px 8px; } .dup-warning { display: grid; gap: 2px; margin-top: 4px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--warning-50); color: var(--warning-700); font-size: 12px; font-weight: 700; }`]
})
export class InstallationsPage {
  private service = inject(DeviceService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);
  access = this.service.access;

  installations = signal<DeviceSite[]>([]);
  sites = signal<Site[]>([]);
  devices = signal<Device[]>([]);
  search = signal('');
  governorates = GOVERNORATES;
  governorate = signal(''); siteId = signal(0); deviceId = signal(0);
  loading = signal(false); saving = signal(false);
  error = signal(''); formError = signal('');
  formOpen = signal(false); editing = signal<DeviceSite | null>(null);
  showPass = signal(false);

  sitesInGovernorate = computed(() => this.governorate() ? this.sites().filter(s => s.governorateCode === this.governorate()) : this.sites());
  /** مواقع نموذج التركيب مجمّعة بمحافظتها (تظهر المحافظات التي فيها مواقع فقط) */
  siteGroups = computed(() => [...GOVERNORATES, { code: "", name: "بلا محافظة" }]
    .map(g => ({ code: g.code, name: g.name, sites: this.sites().filter(s => s.governorateCode === g.code) })).filter(g => g.sites.length));
  hasFilter = computed(() => !!(this.search() || this.governorate() || this.siteId() || this.deviceId()));

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const governorate = this.governorate(); const [site, device] = [this.siteId(), this.deviceId()];
    return this.installations().filter(i =>
      (!governorate || i.governorateCode === governorate) && (!site || i.siteId === site) && (!device || i.deviceId === device)
      && (!q || [i.ip, i.deviceName, i.deviceModel, i.sn, i.userName, i.siteName, i.installLocation, i.note].some(f => (f ?? '').toLowerCase().includes(q))));
  });

  form = inject(FormBuilder).nonNullable.group({
    deviceId: [0, Validators.min(1)],
    siteId: [0, Validators.min(1)],
    ip: ['', [Validators.required, Validators.pattern(IPV4)]],
    subnetMask: ['255.255.255.0', [Validators.required, Validators.pattern(IPV4)]],
    userName: ['', [Validators.required, Validators.maxLength(100)]],
    pass: ['', [Validators.required, Validators.maxLength(200)]],
    note: ['', Validators.maxLength(1000)],
    installLocation: ['', Validators.maxLength(300)],
    sn: ['', Validators.maxLength(100)]
  });

  /** قيم النموذج كإشارة — لتنبيه تكرار الـ IP أثناء الكتابة */
  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** تركيبات أخرى بنفس الـ IP في نفس الموقع (تنبيه فقط — الحفظ مسموح، قرار المستخدم 2026-09-29) */
  formDuplicates = computed(() => {
    const v = this.formValue();
    const ip = (v.ip ?? '').trim();
    const editingId = this.editing()?.id;
    if (!ip || !v.siteId) return [];
    return this.installations().filter(i => i.siteId === Number(v.siteId) && i.ip === ip && i.id !== editingId);
  });

  private duplicateKeys = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.installations()) {
      const key = i.siteId + '|' + i.ip;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  });

  isDuplicate(i: DeviceSite) { return (this.duplicateKeys().get(i.siteId + '|' + i.ip) ?? 0) > 1; }

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => {
      this.governorate.set(p.get('governorate') ?? '');
      this.siteId.set(Number(p.get('siteId')) || 0);
      this.deviceId.set(Number(p.get('deviceId')) || 0);
    });
    this.load();
  }

  join(...parts: string[]) { return parts.filter(p => !!p).join(' · '); }


  setFilter(changes: Record<string, number | string | null>) {
    this.router.navigate([], { queryParams: changes, queryParamsHandling: 'merge' });
  }

  load() {
    this.loading.set(true); this.error.set('');
    forkJoin({
      installations: this.service.installations(),
      sites: this.service.sites(), devices: this.service.devices()
    }).subscribe({
      next: r => {
        this.installations.set(r.installations);
        this.sites.set(r.sites); this.devices.set(r.devices);
        this.loading.set(false);
      },
      error: e => { this.error.set(e.message); this.loading.set(false); }
    });
  }


  openForm(i: DeviceSite | null) {
    this.editing.set(i); this.formError.set(''); this.showPass.set(false);
    this.form.reset({
      deviceId: i?.deviceId ?? (this.deviceId() || 0),
      siteId: i?.siteId ?? (this.siteId() || 0),
      ip: i?.ip ?? '', subnetMask: i?.subnetMask ?? '255.255.255.0',
      userName: i?.userName ?? '', pass: i?.pass ?? '', note: i?.note ?? '', installLocation: i?.installLocation ?? '', sn: i?.sn ?? ''
    });
    this.formOpen.set(true);
  }

  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  async askDelete(i: DeviceSite) {
    if (!await this.confirm.ask(`حذف تركيب «${i.deviceName}» في «${i.siteName}» (${i.ip})؟`, 'حذف')) return;
    this.service.deleteInstallation(i.id).subscribe({
      next: () => { this.toast.success('تم الحذف'); this.load(); },
      error: e => this.toast.error(e.message)
    });
  }


  save() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      deviceId: Number(v.deviceId), siteId: Number(v.siteId), ip: v.ip.trim(), subnetMask: v.subnetMask.trim(),
      userName: v.userName.trim(), pass: v.pass, note: v.note.trim(), installLocation: v.installLocation.trim(), sn: v.sn.trim()
    };
    const i = this.editing();
    this.saving.set(true); this.formError.set('');
    (i ? this.service.updateInstallation(i.id, body) : this.service.createInstallation(body)).subscribe({
      next: () => { this.saving.set(false); this.formOpen.set(false); this.toast.success('تم الحفظ'); this.load(); },
      error: e => { this.saving.set(false); this.formError.set(e.message); }
    });
  }

}
