import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MaintenanceService } from '../data-access/maintenance.service';
import { MaintenanceDevice, MaintenanceLookup } from '../data-access/maintenance.models';
import { Modal } from '@shared/ui/modal';
import { Alert } from '@shared/ui/alert';
import { trackRequest } from '@shared/ui/loader';

/** مقارنة الرقمين بعد حذف الفراغات وبلا تمييز لحالة الأحرف (الباكاند يعامل الرقم كذلك) */
const sameSerial = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * إضافة جهاز صيانة أو تعديله (قرار المستخدم 2026-10-05): الرقم التسلسلي مطلوب ويُكتب مرتين يدوياً
 * (حقل تأكيد)، والنسخ واللصق والسحب معطّلة في الحقلين كي لا يُنقل خطأ الكتابة إلى التأكيد.
 * عند التعديل يُطلب التأكيد فقط إن تغيّر الرقم.
 */
@Component({
  selector: 'app-device-form-dialog', standalone: true, imports: [Alert, ReactiveFormsModule, Modal],
  styleUrl: '../../../shared/styles/devices.scss',
  template: `
    <app-modal [heading]="device() ? 'تعديل جهاز الصيانة' : 'إضافة جهاز صيانة'" [subheading]="device()?.serialNumber ?? 'جهاز يُحضَر للصيانة برقمه التسلسلي'"
               [busy]="saving()" (closed)="closed.emit()">
      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="modal-body form-stack">
          <app-alert [message]="error()" />
          @if (!lookups().deviceTypes.length || !lookups().companies.length) {
            <p class="alert alert-warning" role="status">أضف أنواع الأجهزة والشركات المصنّعة من «إعدادات الصيانة» أولاً.</p>
          }

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">الرقم التسلسلي</span>
              <input formControlName="serialNumber" dir="ltr" maxlength="100" autocomplete="off" spellcheck="false"
                     (copy)="block($event)" (cut)="block($event)" (paste)="block($event)" (drop)="block($event)" (contextmenu)="block($event)">
              @if (form.controls.serialNumber.touched && form.controls.serialNumber.invalid) { <small class="form-error">الرقم التسلسلي مطلوب</small> }
            </label>
            @if (needsConfirm()) {
              <label class="form-field"><span class="form-label">تأكيد الرقم التسلسلي</span>
                <input formControlName="serialConfirm" dir="ltr" maxlength="100" autocomplete="off" spellcheck="false"
                       (copy)="block($event)" (cut)="block($event)" (paste)="block($event)" (drop)="block($event)" (contextmenu)="block($event)">
                @if (form.hasError('serialMismatch') && form.controls.serialConfirm.touched) { <small class="form-error">الرقمان غير متطابقين</small> }
              </label>
            }
          </div>
          @if (needsConfirm()) { <p class="hint-line">اكتب الرقم مرتين يدوياً — النسخ واللصق معطّلان في هذين الحقلين.</p> }
          @if (pasteBlocked()) { <p class="form-error" role="status">النسخ واللصق غير مسموح — اكتب الرقم بنفسك.</p> }

          <div class="form-grid-2">
            <label class="form-field"><span class="form-label">نوع الجهاز</span>
              <select formControlName="deviceTypeId"><option [ngValue]="0">اختر النوع</option>
                @for (x of lookups().deviceTypes; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
            <label class="form-field"><span class="form-label">الشركة المصنّعة</span>
              <select formControlName="deviceCompanyId"><option [ngValue]="0">اختر الشركة</option>
                @for (x of lookups().companies; track x.id) { <option [ngValue]="x.id">{{ x.name }}</option> }</select></label>
            <label class="form-field"><span class="form-label">اسم الجهاز <small class="hint">(اختياري)</small></span><input formControlName="name" maxlength="200"></label>
            <label class="form-field"><span class="form-label">الموديل <small class="hint">(اختياري)</small></span><input formControlName="model" dir="ltr" maxlength="100"></label>
          </div>
          <label class="form-field"><span class="form-label">الوصف <small class="hint">(اختياري)</small></span><textarea formControlName="description" rows="2" maxlength="1000"></textarea></label>
        </div>
        <footer class="modal-actions">
          <button type="button" class="ghost" (click)="closed.emit()" [disabled]="saving()">إلغاء</button>
          <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'جارٍ الحفظ…' : (device() ? 'حفظ التعديلات' : 'إضافة الجهاز') }}</button>
        </footer>
      </form>
    </app-modal>`,
  styles: [`
    .hint-line { margin: -6px 0 0; font-size: 12px; color: var(--ink-500); }
  `]
})
export class DeviceFormDialog implements OnInit {
  private service = inject(MaintenanceService);

  /** null = جهاز جديد */
  device = input<MaintenanceDevice | null>(null);
  /** رقم تسلسلي مقترح لجهاز جديد (من البحث في نموذج الطلب) — يبقى التأكيد مطلوباً بالكتابة */
  initialSerial = input('');
  lookups = input.required<{ deviceTypes: MaintenanceLookup[]; companies: MaintenanceLookup[] }>();
  saved = output<MaintenanceDevice>();
  closed = output<void>();

  saving = signal(false);
  error = signal('');
  pasteBlocked = signal(false);

  form = inject(FormBuilder).nonNullable.group({
    serialNumber: ['', [Validators.required, Validators.maxLength(100), (c: AbstractControl<string>) => c.value.trim() ? null : { required: true }]],
    serialConfirm: [''],
    name: ['', Validators.maxLength(200)],
    model: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(1000)],
    deviceTypeId: [0, Validators.min(1)],
    deviceCompanyId: [0, Validators.min(1)]
  }, { validators: (g: AbstractControl): ValidationErrors | null => this.confirmError(g) });

  ngOnInit() {
    const d = this.device();
    this.form.reset({
      serialNumber: d?.serialNumber ?? this.initialSerial(), serialConfirm: '',
      name: d?.name ?? '', model: d?.model ?? '', description: d?.description ?? '',
      deviceTypeId: d?.deviceTypeId ?? 0, deviceCompanyId: d?.deviceCompanyId ?? 0
    });
  }

  /** التأكيد مطلوب لجهاز جديد، أو عند تغيير رقم جهاز موجود */
  needsConfirm() {
    const d = this.device();
    return !d || !sameSerial(this.form.controls.serialNumber.value, d.serialNumber);
  }

  private confirmError(g: AbstractControl): ValidationErrors | null {
    if (!this.form || !this.needsConfirm()) return null;
    const { serialNumber, serialConfirm } = g.getRawValue();
    return serialNumber.trim() && sameSerial(serialNumber, serialConfirm) ? null : { serialMismatch: true };
  }

  block(event: Event) {
    event.preventDefault();
    if (event.type !== 'contextmenu') this.pasteBlocked.set(true);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const body = {
      serialNumber: v.serialNumber.trim(), name: v.name.trim(), model: v.model.trim(), description: v.description.trim(),
      deviceTypeId: v.deviceTypeId, deviceCompanyId: v.deviceCompanyId
    };
    const d = this.device();
    trackRequest((d ? this.service.updateDevice(d.id, body) : this.service.createDevice(body)), this.saving, this.error, result => { this.saved.emit(result); });
  }
}
