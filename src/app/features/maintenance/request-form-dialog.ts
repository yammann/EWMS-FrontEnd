import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaintenanceService } from '../../core/services/maintenance.service';
import {
  MaintenanceClient, MaintenanceDevice, MaintenanceLookup, MaintenanceRequest, MaintenanceStatus, TechnicianOption, finalStageConfirm, isFinalStage
} from '../../core/models/maintenance.models';
import { ConfirmService } from '../../shared/ui/confirm.service';
import { Modal } from '../../shared/ui/modal';
import { isValidPhone, normalizePhone } from '../../core/utils/phone';
import { DeviceFormDialog } from './device-form-dialog';

export interface RequestLookups {
  deviceTypes: MaintenanceLookup[];
  companies: MaintenanceLookup[];
  damageTypes: MaintenanceLookup[];
  statuses: MaintenanceStatus[];
}

/**
 * تسجيل طلب صيانة جديد أو تعديله. الفني = من يسجّل الطلب (يُملأ في الباكاند).
 * الجهاز يُختار من «أجهزة الصيانة» بالرقم التسلسلي (MaintenanceDevices/BySerial)؛ إن لم يكن مسجّلاً يُضاف أولاً
 * (نافذة الجهاز: الرقم يُكتب مرتين بلا لصق) ثم يُقدَّم الطلب بمعرّفه — الطلب لا يحمل بيانات الجهاز بنفسه.
 */
@Component({
  selector: 'app-request-form-dialog', standalone: true, imports: [ReactiveFormsModule, Modal, DeviceFormDialog],
  styleUrl: '../devices/devices.scss',
  template: `
    <app-modal [heading]="request() ? 'تعديل طلب الصيانة' : 'طلب صيانة جديد'" [subheading]="request()?.number ?? 'استلام جهاز من عميل'"
               size="lg" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @if (missingLookups()) { <p class="alert alert-warning" role="status">{{ missingLookups() }} — أضفها من «إعدادات الصيانة» أولاً.</p> }

          <fieldset class="group"><legend>العميل</legend>
            @if (client(); as c) {
              <div class="device-card">
                <div class="device-info"><span class="serial">موظف في المؤسسة</span><strong>{{ c.fullName }}</strong><small>{{ c.departmentName || '—' }}</small></div>
                <button type="button" class="btn btn-ghost btn-sm" (click)="changeClient()" [disabled]="saving()">تغيير العميل</button>
              </div>
            } @else if (!external()) {
              <label class="form-field"><span class="form-label">اسم العميل الكامل أو رقمه الذاتي</span>
                <span class="with-btn">
                  <input [value]="clientQuery()" (input)="clientQuery.set($any($event.target).value); matches.set([])" (keydown.enter)="$event.preventDefault(); findClient()"
                         maxlength="200" autocomplete="off" placeholder="مطابقة تامة — ثم «بحث»">
                  <button type="button" class="btn btn-sm" (click)="findClient()" [disabled]="!clientQuery().trim() || clientSearching()">{{ clientSearching() ? 'جارٍ البحث…' : 'بحث' }}</button>
                </span>
              </label>
              @if (matches().length > 1) {
                <div class="matches" role="listbox" aria-label="موظفون بنفس الاسم">
                  <span class="hint">أكثر من موظف بهذا الاسم — اختر حسب القسم، أو ابحث بالرقم الذاتي:</span>
                  @for (m of matches(); track m.id) { <button type="button" class="btn btn-ghost btn-sm" (click)="pickClient(m)">{{ m.fullName }} — {{ m.departmentName || 'بلا قسم' }}</button> }
                </div>
              }
              @if (clientError()) { <p class="form-error" role="alert">{{ clientError() }}</p> }
            }
            @if (external()) {
              <p class="hint ext-note">لم يُعثر على موظف — عميل من خارج المؤسسة. <button type="button" class="btn btn-ghost btn-sm" (click)="changeClient()" [disabled]="saving()">بحث من جديد</button></p>
            }
            <div class="form-grid-2 top-gap">
              @if (external()) {
                <label class="form-field"><span class="form-label">اسم العميل</span><input formControlName="clientName" maxlength="200" autocomplete="off">
                  @if (form.controls.clientName.touched && form.controls.clientName.invalid) { <small class="form-error">اسم العميل مطلوب</small> }</label>
              }
              <label class="form-field"><span class="form-label">رقم الهاتف <small class="hint">(اختياري)</small></span><input formControlName="clientPhone" dir="ltr" maxlength="20" inputmode="tel" placeholder="0933 123 456" (input)="cleanPhone()">
                @if (form.controls.clientPhone.invalid) { <small class="form-error">رقم غير صحيح — جوال 09 ثم 8 أرقام، أو أرضي مع رمز المحافظة</small> }</label>
            </div>
          </fieldset>

          <fieldset class="group"><legend>الجهاز</legend>
            @if (device(); as d) {
              <div class="device-card">
                <div class="device-info">
                  <span class="mono serial">{{ d.serialNumber }}</span>
                  <strong>{{ d.name || d.deviceTypeName }}</strong>
                  <small>{{ d.deviceTypeName }} · {{ d.deviceCompanyName }}{{ d.model ? ' · ' + d.model : '' }}</small>
                </div>
                @if (can().viewDevices) { <button type="button" class="btn btn-ghost btn-sm" (click)="changeDevice()" [disabled]="saving()">تغيير الجهاز</button> }
              </div>
            } @else if (!can().viewDevices) {
              <p class="alert alert-warning" role="status">لا تملك صلاحية عرض أجهزة الصيانة، فلا يمكن اختيار جهاز الطلب.</p>
            } @else {
              <label class="form-field"><span class="form-label">الرقم التسلسلي للجهاز</span>
                <span class="with-btn">
                  <input [value]="serialQuery()" (input)="serialQuery.set($any($event.target).value); notFound.set('')" (keydown.enter)="$event.preventDefault(); findDevice()"
                         dir="ltr" maxlength="100" autocomplete="off" placeholder="اكتب الرقم ثم «بحث»">
                  <button type="button" class="btn btn-sm" (click)="findDevice()" [disabled]="!serialQuery().trim() || searching()">{{ searching() ? 'جارٍ البحث…' : 'بحث' }}</button>
                </span>
              </label>
              @if (notFound(); as serial) {
                <div class="alert alert-warning not-found" role="status">
                  <span>لا يوجد جهاز مسجّل بالرقم «<span class="mono">{{ serial }}</span>».</span>
                  @if (can().createDevice) { <button type="button" class="btn btn-sm" (click)="addOpen.set(true)">إضافة الجهاز</button> }
                  @else { <span>اطلب من صاحب صلاحية إضافة الأجهزة تسجيله أولاً.</span> }
                </div>
              }
              @if (lookupError()) { <p class="form-error" role="alert">{{ lookupError() }}</p> }
            }
            <div class="form-grid-2 top-gap">
              @if (canAssignOnCreate()) {
                <label class="form-field full"><span class="form-label">الفني المسؤول</span>
                  <select formControlName="assigneeId">
                    <option [ngValue]="0">أنا (من يسجّل الطلب)</option>
                    @for (u of assignees(); track u.id) { <option [ngValue]="u.id">{{ u.fullName }}</option> }
                  </select>
                  <small class="hint">يصل إشعار للموظف المسند إليه الطلب</small>
                </label>
              }
              <label class="form-field full"><span class="form-label">الملحقات المستلمة <small class="hint">(اختياري — شاحن، حقيبة، كابل…)</small></span><input formControlName="accessories" maxlength="500"></label>
            </div>
          </fieldset>

          <fieldset class="group"><legend>الصيانة</legend>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">نوع العطل</span>
                <select formControlName="damageTypeId"><option [ngValue]="0">اختر العطل</option>
                  @for (x of lookups().damageTypes; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
              <label class="form-field"><span class="form-label">حالة الطلب</span>
                <select formControlName="maintenanceRequestStatusId"><option [ngValue]="0">اختر الحالة</option>
                  @for (x of statusOptions(); track x.id) { <option [ngValue]="x.id">{{ x.name }}{{ isFinal(x.stage) ? ' (نهائية)' : '' }}</option> }</select>
                <small class="hint">وقتا بدء العمل والإنجاز يُسجَّلان تلقائياً حسب مرحلة الحالة</small></label>
              <label class="form-field full"><span class="form-label">وصف العطل والملاحظات <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="2000"></textarea></label>
            </div>
          </fieldset>
        </div>
        <footer class="modal-actions">
          @if (!(client() || external())) { <span class="footer-note">ابحث عن العميل أولاً</span> }
          @else if (!device()) { <span class="footer-note">اختر الجهاز أولاً</span> }
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="form.invalid || !device() || !(client() || external()) || saving()">{{ saving() ? 'جارٍ الحفظ…' : (request() ? 'حفظ التعديلات' : 'تسجيل الطلب') }}</button>
        </footer>
      </form>
    </app-modal>

    @if (addOpen()) {
      <app-device-form-dialog [initialSerial]="notFound()" [lookups]="lookups()" (saved)="deviceAdded($event)" (closed)="addOpen.set(false)" />
    }`,
  styles: [`
    .group { border: 0; padding: 0; margin: 0 0 18px; min-width: 0; }
    .group:last-child { margin-bottom: 0; }
    .group legend { padding: 0; margin-bottom: 10px; font-size: 12px; font-weight: 700; color: var(--brand-700); }
    .with-btn { display: flex; gap: 8px; align-items: center; }
    .with-btn input { flex: 1; min-width: 0; }
    .device-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px;
      border-radius: var(--radius-lg); background: var(--brand-50); }
    .device-info { display: grid; gap: 2px; min-width: 0; }
    .device-info .serial { font-size: 12px; color: var(--brand-800); font-weight: 700; }
    .device-info small { color: var(--ink-500); }
    .not-found { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 8px; }
    .top-gap { margin-top: 12px; }
    .matches { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .ext-note { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
    .footer-note { margin-inline-end: auto; font-size: 12px; color: var(--ink-500); }
  `]
})
export class RequestFormDialog implements OnInit {
  private service = inject(MaintenanceService);
  private confirm = inject(ConfirmService);
  can = this.service.can;

  /** null = طلب جديد */
  request = input<MaintenanceRequest | null>(null);
  lookups = input.required<RequestLookups>();
  saved = output<MaintenanceRequest>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');

  /** الجهاز المختار (من البحث بالرقم التسلسلي، أو جهاز الطلب عند التعديل) */
  device = signal<MaintenanceDevice | null>(null);
  serialQuery = signal('');
  searching = signal(false);
  /** الرقم الذي لم يُعثر عليه (يُقترح في نافذة إضافة الجهاز) */
  notFound = signal('');
  lookupError = signal('');
  addOpen = signal(false);
  /** العميل: موظف (بحث تام بالاسم الكامل أو الرقم الذاتي) أو خارجي عند عدم العثور عليه */
  client = signal<MaintenanceClient | null>(null);
  external = signal(false);
  clientQuery = signal('');
  clientSearching = signal(false);
  clientError = signal('');
  matches = signal<MaintenanceClient[]>([]);

  /** موظفو قسمي للإسناد عند الإنشاء (AssignMaintenanceRequest) */
  assignees = signal<TechnicianOption[]>([]);
  canAssignOnCreate = () => !this.request() && this.can().assignRequest;

  form = inject(FormBuilder).nonNullable.group({
    clientName: ['', [Validators.required, Validators.maxLength(200)]],
    clientPhone: ['', (c: AbstractControl<string>) => isValidPhone(c.value) ? null : { phone: true }],
    damageTypeId: [0, Validators.min(1)],
    maintenanceRequestStatusId: [0, Validators.min(1)],
    accessories: ['', Validators.maxLength(500)],
    assigneeId: [0],
    description: ['', Validators.maxLength(2000)]
  });

  isFinal = isFinalStage;
  /** طلب جديد لا يُسجَّل في حالة نهائية (مُسلَّم / غير قابل للصيانة) — الباكاند يرفضه أيضاً */
  statusOptions = () => this.request() ? this.lookups().statuses : this.lookups().statuses.filter(s => !isFinalStage(s.stage));

  ngOnInit() {
    const r = this.request();
    const options = this.statusOptions();
    this.form.reset({
      clientName: r?.clientName ?? '', clientPhone: r?.clientPhone ?? '', damageTypeId: r?.damageTypeId ?? 0,
      // طلب جديد: أول حالة في مرحلة «جديد»، وإلا أول حالة غير نهائية
      maintenanceRequestStatusId: r?.maintenanceRequestStatusId ?? (options.find(s => s.stage === 1) ?? options[0])?.id ?? 0,
      accessories: r?.accessories ?? '', description: r?.description ?? ''
    });
    // العميل عند التعديل: موظف مربوط، أو خارجي بالاسم المسجّل؛ وعند الإنشاء يبدأ بالبحث
    if (r?.clientUserId) this.client.set({ id: r.clientUserId, fullName: r.clientName, departmentName: r.clientDepartmentName, phone: r.clientPhone });
    else if (r) this.external.set(true);

    if (this.canAssignOnCreate())
      this.service.assignees().subscribe({ next: list => this.assignees.set(list), error: () => { } });
    if (r) {
      this.device.set({
        id: r.deviceMaintenanceId, name: r.deviceName, serialNumber: r.serialNumber, model: r.model, description: '',
        deviceTypeId: r.deviceTypeId, deviceTypeName: r.deviceTypeName, deviceCompanyId: r.deviceCompanyId, deviceCompanyName: r.deviceCompanyName
      });
    }
    // تعديل طلب: الحالة تُغيَّر بصلاحية تغيير الحالة فقط (الباكاند يرفض غير ذلك)؛ الطلب الجديد يختار حالته
    if (r && !(this.can().changeStatus && r.canChangeStatus)) this.form.controls.maintenanceRequestStatusId.disable();
  }

  missingLookups() {
    const l = this.lookups();
    const missing = [!l.damageTypes.length && 'أنواع الأعطال', !l.statuses.length && 'حالات الطلب'].filter(Boolean);
    return missing.length ? 'لا توجد بيانات في: ' + missing.join('، ') : '';
  }

  findClient() {
    const text = this.clientQuery().trim();
    if (!text || this.clientSearching()) return;
    this.clientSearching.set(true); this.clientError.set(''); this.matches.set([]);
    this.service.clientLookup(text).subscribe({
      next: list => {
        this.clientSearching.set(false);
        if (list.length === 1) this.pickClient(list[0]);
        else if (list.length > 1) this.matches.set(list);
        else {
          // لا موظف مطابق: عميل من خارج المؤسسة — الاسم المكتوب يُقترح (إن لم يكن رقماً ذاتياً)
          this.external.set(true);
          if (!/^[A-Za-z0-9-]+$/.test(text)) this.form.controls.clientName.setValue(text);
        }
      },
      error: e => { this.clientSearching.set(false); this.clientError.set(e.message); }
    });
  }

  pickClient(c: MaintenanceClient) {
    this.client.set(c); this.matches.set([]); this.external.set(false);
    this.form.controls.clientName.setValue(c.fullName);
    if (!this.form.controls.clientPhone.value && c.phone) this.form.controls.clientPhone.setValue(c.phone);
  }

  changeClient() {
    this.clientQuery.set(this.client()?.fullName ?? this.form.controls.clientName.value);
    this.client.set(null); this.external.set(false); this.matches.set([]);
    this.form.controls.clientName.setValue('');
  }

  findDevice() {
    const serial = this.serialQuery().trim();
    if (!serial || this.searching()) return;
    this.searching.set(true); this.notFound.set(''); this.lookupError.set('');
    this.service.deviceBySerial(serial).subscribe({
      next: d => { this.searching.set(false); this.device.set(d); },
      error: (e: { status: number; message: string }) => {
        this.searching.set(false);
        if (e.status === 404) this.notFound.set(serial);
        else this.lookupError.set(e.message);
      }
    });
  }

  deviceAdded(d: MaintenanceDevice) {
    this.addOpen.set(false); this.notFound.set(''); this.serialQuery.set('');
    this.device.set(d);
  }

  changeDevice() {
    this.serialQuery.set(this.device()?.serialNumber ?? '');
    this.device.set(null);
  }

  /** يمنع كتابة غير الأرقام و + والفراغ والشرطة في حقل الهاتف */
  cleanPhone() {
    const control = this.form.controls.clientPhone;
    const cleaned = control.value.replace(/[^\d+\s-]/g, '').replace(/(?!^)\+/g, '');
    if (cleaned !== control.value) control.setValue(cleaned);
  }

  async save() {
    const device = this.device();
    if (this.form.invalid || !device || this.saving()) return;
    const v = this.form.getRawValue();
    const r = this.request();
    // التحويل إلى حالة نهائية يُقفل الطلب — يحتاج تأكيداً صريحاً
    const target = this.lookups().statuses.find(s => s.id === v.maintenanceRequestStatusId);
    if (r && target && v.maintenanceRequestStatusId !== r.maintenanceRequestStatusId && isFinalStage(target.stage)
        && !await this.confirm.ask(finalStageConfirm(r.number, target.name), 'نعم، أقفل الطلب', 'حالة نهائية')) return;
    const body = {
      clientUserId: this.client()?.id ?? null,
      clientName: (this.client()?.fullName ?? v.clientName).trim(), clientPhone: normalizePhone(v.clientPhone),
      deviceMaintenanceId: device.id, damageTypeId: v.damageTypeId,
      assigneeId: r ? null : (v.assigneeId || null),
      accessories: v.accessories.trim(), description: v.description.trim(),
      maintenanceRequestStatusId: v.maintenanceRequestStatusId
    };
    this.saving.set(true); this.error.set('');
    (r ? this.service.updateRequest(r.id, body) : this.service.createRequest(body)).subscribe({
      next: result => { this.saving.set(false); this.saved.emit(result); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
