import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaintenanceService } from '../../core/services/maintenance.service';
import { MaintenanceLookup, MaintenanceRequest, MaintenanceStatus, nowLocalInput, toLocalInput } from '../../core/models/maintenance.models';
import { Modal } from '../../shared/ui/modal';
import { isValidPhone, normalizePhone } from '../../core/utils/phone';

export interface RequestLookups {
  deviceTypes: MaintenanceLookup[];
  companies: MaintenanceLookup[];
  damageTypes: MaintenanceLookup[];
  statuses: MaintenanceStatus[];
}

/** تسجيل طلب صيانة جديد أو تعديله. الفني = من يسجّل الطلب (يُملأ في الباكاند). */
@Component({
  selector: 'app-request-form-dialog', standalone: true, imports: [ReactiveFormsModule, Modal],
  styleUrl: '../devices/devices.scss',
  template: `
    <app-modal [heading]="request() ? 'تعديل طلب الصيانة' : 'طلب صيانة جديد'" [subheading]="request()?.number ?? 'استلام جهاز من عميل'"
               size="lg" [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body">
          @if (error()) { <p class="alert alert-error" role="alert">{{ error() }}</p> }
          @if (missingLookups()) { <p class="alert alert-warning" role="status">{{ missingLookups() }} — أضفها من «إعدادات الصيانة» أولاً.</p> }

          <fieldset class="group"><legend>العميل</legend>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">اسم العميل</span><input formControlName="clientName" maxlength="200" autocomplete="off">
                @if (form.controls.clientName.touched && form.controls.clientName.invalid) { <small class="form-error">اسم العميل مطلوب</small> }</label>
              <label class="form-field"><span class="form-label">رقم الهاتف <small class="hint">(اختياري)</small></span><input formControlName="clientPhone" dir="ltr" maxlength="20" inputmode="tel" placeholder="0933 123 456" (input)="cleanPhone()">
                @if (form.controls.clientPhone.invalid) { <small class="form-error">رقم غير صحيح — جوال 09 ثم 8 أرقام، أو أرضي مع رمز المحافظة</small> }</label>
            </div>
          </fieldset>

          <fieldset class="group"><legend>الجهاز</legend>
            <div class="form-grid-2">
              <label class="form-field"><span class="form-label">نوع الجهاز</span>
                <select formControlName="deviceTypeId"><option [ngValue]="0">اختر النوع</option>
                  @for (x of lookups().deviceTypes; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
              <label class="form-field"><span class="form-label">الشركة المصنّعة</span>
                <select formControlName="deviceCompanyId"><option [ngValue]="0">اختر الشركة</option>
                  @for (x of lookups().companies; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
              <label class="form-field"><span class="form-label">الموديل <small class="hint">(اختياري)</small></span><input formControlName="model" dir="ltr" maxlength="100"></label>
              <label class="form-field"><span class="form-label">الرقم التسلسلي <small class="hint">(اختياري)</small></span><input formControlName="serialNumber" dir="ltr" maxlength="100"></label>
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
                  @for (x of lookups().statuses; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
              <label class="form-field"><span class="form-label">تاريخ البدء <small class="hint">(اختياري)</small></span>
                <span class="with-btn"><input type="datetime-local" formControlName="startedAt"><button type="button" class="btn btn-ghost btn-sm" (click)="setNow('startedAt')">الآن</button></span></label>
              <label class="form-field"><span class="form-label">تاريخ الإنجاز <small class="hint">(اختياري)</small></span>
                <span class="with-btn"><input type="datetime-local" formControlName="completedAt" [min]="form.controls.startedAt.value"><button type="button" class="btn btn-ghost btn-sm" (click)="setNow('completedAt')">الآن</button></span>
                @if (dateError()) { <small class="form-error">تاريخ الإنجاز لا يسبق تاريخ البدء</small> }</label>
              <label class="form-field full"><span class="form-label">وصف العطل والملاحظات <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="3" maxlength="2000"></textarea></label>
            </div>
          </fieldset>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="form.invalid || dateError() || saving()">{{ saving() ? 'جارٍ الحفظ…' : (request() ? 'حفظ التعديلات' : 'تسجيل الطلب') }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .group { border: 0; padding: 0; margin: 0 0 18px; min-width: 0; }
    .group:last-child { margin-bottom: 0; }
    .group legend { padding: 0; margin-bottom: 10px; font-size: 12px; font-weight: 700; color: var(--brand-700); }
    .with-btn { display: flex; gap: 8px; align-items: center; }
    .with-btn input { flex: 1; min-width: 0; }
  `]
})
export class RequestFormDialog implements OnInit {
  private service = inject(MaintenanceService);

  /** null = طلب جديد */
  request = input<MaintenanceRequest | null>(null);
  lookups = input.required<RequestLookups>();
  saved = output<MaintenanceRequest>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');

  form = inject(FormBuilder).nonNullable.group({
    clientName: ['', [Validators.required, Validators.maxLength(200)]],
    clientPhone: ['', (c: AbstractControl<string>) => isValidPhone(c.value) ? null : { phone: true }],
    deviceTypeId: [0, Validators.min(1)],
    deviceCompanyId: [0, Validators.min(1)],
    damageTypeId: [0, Validators.min(1)],
    maintenanceRequestStatusId: [0, Validators.min(1)],
    model: ['', Validators.maxLength(100)],
    serialNumber: ['', Validators.maxLength(100)],
    accessories: ['', Validators.maxLength(500)],
    description: ['', Validators.maxLength(2000)],
    startedAt: [''],
    completedAt: ['']
  });

  ngOnInit() {
    const r = this.request();
    this.form.reset({
      clientName: r?.clientName ?? '', clientPhone: r?.clientPhone ?? '',
      deviceTypeId: r?.deviceTypeId ?? 0, deviceCompanyId: r?.deviceCompanyId ?? 0, damageTypeId: r?.damageTypeId ?? 0,
      // طلب جديد: أول حالة في القائمة (عادةً «جديد»)
      maintenanceRequestStatusId: r?.maintenanceRequestStatusId ?? this.lookups().statuses[0]?.id ?? 0,
      model: r?.model ?? '', serialNumber: r?.serialNumber ?? '', accessories: r?.accessories ?? '', description: r?.description ?? '',
      startedAt: toLocalInput(r?.startedAt), completedAt: toLocalInput(r?.completedAt)
    });
    // تعديل طلب: الحالة تُغيَّر بصلاحية تغيير الحالة فقط (الباكاند يرفض غير ذلك)؛ الطلب الجديد يختار حالته
    if (r && !(this.service.can().changeStatus && r.canChangeStatus)) this.form.controls.maintenanceRequestStatusId.disable();
  }

  missingLookups() {
    const l = this.lookups();
    const missing = [
      !l.deviceTypes.length && 'أنواع الأجهزة', !l.companies.length && 'الشركات المصنّعة',
      !l.damageTypes.length && 'أنواع الأعطال', !l.statuses.length && 'حالات الطلب'
    ].filter(Boolean);
    return missing.length ? 'لا توجد بيانات في: ' + missing.join('، ') : '';
  }

  dateError() {
    const { startedAt, completedAt } = this.form.getRawValue();
    return !!startedAt && !!completedAt && completedAt < startedAt;
  }

  /** يمنع كتابة غير الأرقام و + والفراغ والشرطة في حقل الهاتف */
  cleanPhone() {
    const control = this.form.controls.clientPhone;
    const cleaned = control.value.replace(/[^\d+\s-]/g, '').replace(/(?!^)\+/g, '');
    if (cleaned !== control.value) control.setValue(cleaned);
  }

  setNow(control: 'startedAt' | 'completedAt') {
    this.form.controls[control].setValue(nowLocalInput());
    this.form.controls[control].markAsDirty();
  }

  save() {
    if (this.form.invalid || this.dateError() || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      ...v,
      clientName: v.clientName.trim(), clientPhone: normalizePhone(v.clientPhone), model: v.model.trim(),
      serialNumber: v.serialNumber.trim(), accessories: v.accessories.trim(), description: v.description.trim(),
      startedAt: v.startedAt || null, completedAt: v.completedAt || null
    };
    const r = this.request();
    this.saving.set(true); this.error.set('');
    (r ? this.service.updateRequest(r.id, body) : this.service.createRequest(body)).subscribe({
      next: result => { this.saving.set(false); this.saved.emit(result); },
      error: e => { this.saving.set(false); this.error.set(e.message); }
    });
  }
}
